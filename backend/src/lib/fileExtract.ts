// Extracción universal de texto SIN IA. Convierte casi cualquier archivo en texto
// para que los parsers de campos (HUD, survey, planos, permisos, etc.) puedan
// leerlo, sin importar el formato:
//   PDF        -> pdf-parse, con OCR (tesseract) si es escaneado
//   Imagen     -> OCR directo (tesseract): jpg/png/webp/heic/tiff/bmp/gif
//   Word .docx -> mammoth (texto plano)
//   Excel/CSV  -> texto de celdas (ExcelJS / CSV simple)
//   Texto      -> utf8 tal cual
import { extractPdfText } from './pdfOcr'
import ExcelJS from 'exceljs'

export interface ExtractResult { text: string; method: string; ocrUsed: boolean }

export function detectKind(mimetype?: string, filename?: string) {
  const name = (filename || '').toLowerCase()
  const mt = (mimetype || '').toLowerCase()
  const isPdf = mt === 'application/pdf' || name.endsWith('.pdf')
  const isImage = mt.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|bmp|tiff?|gif)$/i.test(name)
  const isWord = mt.includes('wordprocessingml') || mt === 'application/msword' || name.endsWith('.docx') || name.endsWith('.doc')
  const isExcel = mt.includes('spreadsheetml') || mt.includes('ms-excel') || mt.includes('opendocument.spreadsheet') || mt === 'text/csv' || /\.(xlsx|xlsm|xls|ods|csv)$/i.test(name)
  return { isPdf, isImage, isWord, isExcel }
}

export async function extractTextFromFile(buffer: Buffer, mimetype?: string, filename?: string, opts?: { forceOcr?: boolean }): Promise<ExtractResult> {
  const { isPdf, isImage, isWord, isExcel } = detectKind(mimetype, filename)

  if (isPdf) {
    const r = await extractPdfText(buffer, { force: opts?.forceOcr })
    return { text: r.text, method: r.ocrUsed ? 'pdf-ocr' : 'pdf', ocrUsed: r.ocrUsed }
  }

  if (isWord) {
    try {
      const mammoth = await import('mammoth')
      const r = await mammoth.extractRawText({ buffer })
      return { text: r.value || '', method: 'word', ocrUsed: false }
    } catch (e) {
      // .doc binario antiguo no lo soporta mammoth (solo .docx).
      console.warn('[fileExtract] word parse fail:', e instanceof Error ? e.message : e)
      return { text: '', method: 'word-unsupported', ocrUsed: false }
    }
  }

  if (isExcel) {
    try {
      const text = await extractExcelText(buffer)
      return { text, method: 'excel', ocrUsed: false }
    } catch (e) {
      console.warn('[fileExtract] excel parse fail:', e instanceof Error ? e.message : e)
      return { text: '', method: 'excel-error', ocrUsed: false }
    }
  }

  if (isImage) {
    // Solo pasamos a OCR imágenes con firma válida (PNG/JPEG/WEBP/GIF/BMP/TIFF).
    // Un archivo corrupto o no-imagen puede abortar el módulo WASM de tesseract y
    // tumbar el proceso; validar la firma evita ese fallo por completo.
    if (!hasValidImageSignature(buffer)) {
      return { text: '', method: 'image-unsupported', ocrUsed: false }
    }
    try {
      const text = await runImageOcr(buffer)
      return { text, method: 'image-ocr', ocrUsed: true }
    } catch (e) {
      console.warn('[fileExtract] image OCR fail:', e instanceof Error ? e.message : e)
      return { text: '', method: 'image-ocr-error', ocrUsed: true }
    }
  }

  // Fallback: intentar texto plano.
  return { text: buffer.toString('utf8'), method: 'text', ocrUsed: false }
}

// Valida por magic bytes que el buffer sea una imagen que tesseract puede decodificar.
function hasValidImageSignature(b: Buffer): boolean {
  if (b.length < 12) return false
  const hex4 = b.subarray(0, 4).toString('hex')
  if (hex4 === '89504e47') return true                         // PNG
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true // JPEG
  if (b.subarray(0, 3).toString('ascii') === 'GIF') return true    // GIF
  if (b[0] === 0x42 && b[1] === 0x4d) return true                  // BMP
  if (hex4 === '49492a00' || hex4 === '4d4d002a') return true      // TIFF
  if (b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return true // WEBP
  return false
}

async function runImageOcr(buffer: Buffer): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', undefined, { logger: () => {} })
  try {
    // Acotamos el OCR con un timeout: si una imagen dañada hace colgar el WASM,
    // la petición responde igual (no queda colgada eternamente).
    const recognize = worker.recognize(buffer).then(r => r.data.text || '')
    const timeout = new Promise<string>((_, reject) => setTimeout(() => reject(new Error('OCR timeout')), 45000))
    return await Promise.race([recognize, timeout])
  } finally {
    try { await worker.terminate() } catch { /* worker abortado: ignorar */ }
  }
}

async function extractExcelText(buffer: Buffer): Promise<string> {
  // xlsx/ods son ZIP (magic "PK"). Si no, es CSV/texto.
  const isZip = buffer.length > 1 && buffer[0] === 0x50 && buffer[1] === 0x4b
  if (!isZip) return buffer.toString('utf8')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  const parts: string[] = []
  wb.eachSheet((sheet) => {
    parts.push(`=== ${sheet.name} ===`)
    sheet.eachRow((row) => {
      const cells: string[] = []
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v: unknown = cell.value
        if (v == null) return
        if (typeof v === 'object' && 'result' in (v as object)) cells.push(String((v as { result: unknown }).result ?? ''))
        else if (typeof v === 'object' && 'text' in (v as object)) cells.push(String((v as { text: unknown }).text ?? ''))
        else cells.push(String(v))
      })
      if (cells.length) parts.push(cells.join('\t'))
    })
  })
  return parts.join('\n')
}
