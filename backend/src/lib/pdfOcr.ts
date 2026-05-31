// OCR helper para PDFs escaneados o image-based.
// Estrategia:
//   1. pdf-parse intenta extraer texto. Si devuelve >100 chars útiles, fin.
//   2. Si texto es <100 chars o sospechoso (sólo espacios/símbolos), invoca OCR.
//   3. OCR renderiza cada página a PNG y le pasa por Tesseract.
// Trade-off: OCR es lento (~5s por página) pero es la única forma de extraer
// datos de PDFs escaneados con fotos/scans.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>

/**
 * Extrae texto de un PDF. Si el texto extraído es muy corto (señal de PDF
 * escaneado), hace fallback a OCR.
 */
export async function extractPdfText(buffer: Buffer): Promise<{ text: string; ocrUsed: boolean; pages: number }> {
  // Intento 1: pdf-parse normal
  let text = ''
  let pages = 0
  try {
    const parsed = await pdfParse(buffer)
    text = parsed.text || ''
    pages = parsed.numpages || 0
  } catch (e) {
    console.warn('[pdf-ocr] pdf-parse fail:', e instanceof Error ? e.message : e)
  }

  // Heurística de "PDF escaneado": pdf-parse devolvió < 100 chars no-whitespace,
  // o la densidad de letras es muy baja respecto al tamaño del buffer.
  const meaningful = text.replace(/\s/g, '').length
  const looksScanned = meaningful < 100 || (buffer.length > 50000 && meaningful < 200)

  if (!looksScanned) {
    return { text, ocrUsed: false, pages }
  }

  // Intento 2: OCR vía tesseract.js. pdf-to-img convierte cada página a PNG.
  try {
    const ocrText = await runOcr(buffer)
    return { text: ocrText, ocrUsed: true, pages }
  } catch (e) {
    console.warn('[pdf-ocr] OCR fallback fail:', e instanceof Error ? e.message : e)
    // Si el OCR falla, devolvemos lo que sea que pdf-parse haya extraído (puede ser '')
    return { text, ocrUsed: false, pages }
  }
}

async function runOcr(buffer: Buffer): Promise<string> {
  // Lazy import para que el server arranque rápido aunque tesseract no se use.
  const { pdf } = await import('pdf-to-img')
  const { createWorker } = await import('tesseract.js')

  const document = await pdf(buffer, { scale: 2 })
  const worker = await createWorker('eng', undefined, {
    // Silencia logs de tesseract por defecto
    logger: () => {},
  })

  try {
    const pieces: string[] = []
    for await (const image of document) {
      const result = await worker.recognize(image)
      pieces.push(result.data.text)
    }
    return pieces.join('\n')
  } finally {
    await worker.terminate()
  }
}
