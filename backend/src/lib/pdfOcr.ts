// OCR helper para PDFs escaneados o image-based.
// Estrategia:
//   1. pdf-parse intenta extraer texto. Si el texto es suficiente y denso, fin.
//   2. Si el texto es corto, de baja densidad por página (típico de scans con
//      basura de scanner) o se pide `force`, invoca OCR.
//   3. OCR renderiza cada página a PNG y la pasa por Tesseract, con timeout
//      por página para que un scan dañado nunca cuelgue la petición.
// Trade-off: OCR es lento (~5s por página) pero es la única forma de extraer
// datos de PDFs escaneados (HUD de cierre, cartas del lender, planos, draws).

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string; numpages: number }>

export interface PdfTextResult { text: string; ocrUsed: boolean; pages: number }

// Límites de protección de memoria (Render Starter = 512MB):
//   - El auto-split del frontend genera partes de hasta ~9.3MB, por eso el
//     límite de OCR debe estar POR ENCIMA (antes 8MB: los HUD escaneados
//     partidos en 9MB se saltaban el OCR en silencio — bug real reportado).
//   - La memoria del OCR la domina la rasterización POR PÁGINA (scale), no el
//     tamaño total del buffer: se procesa página a página y se limita el total.
const MAX_OCR_BUFFER = 20 * 1024 * 1024
const MAX_OCR_PAGES = 12 // HUD/Closing Disclosure reales: 5-12 páginas
const PER_PAGE_TIMEOUT_MS = 60_000

/**
 * Extrae texto de un PDF. Si el texto extraído es corto o poco denso (señal de
 * PDF escaneado), hace fallback a OCR. Con `opts.force` el OCR corre siempre
 * (lo usa el retry de files.ts cuando el parseo no encontró ningún dato).
 */
export async function extractPdfText(buffer: Buffer, opts?: { force?: boolean }): Promise<PdfTextResult> {
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

  // Heurística de "PDF escaneado":
  //   a) < 100 chars útiles en total, o
  //   b) buffer grande con < 200 chars (portada de texto + resto escaneado), o
  //   c) densidad < 120 chars útiles por página (scanner que deja texto basura
  //      o metadata: parecía "legible" pero no hay contenido real que parsear).
  const meaningful = text.replace(/\s/g, '').length
  const density = pages > 0 ? meaningful / pages : meaningful
  const looksScanned = meaningful < 100 || (buffer.length > 50000 && meaningful < 200) || density < 120

  if (!looksScanned && !opts?.force) {
    return { text, ocrUsed: false, pages }
  }

  if (buffer.length > MAX_OCR_BUFFER) {
    console.warn('[pdf-ocr] PDF demasiado grande para OCR en este plan:', (buffer.length / 1048576).toFixed(1), 'MB')
    return { text, ocrUsed: false, pages }
  }

  // Intento 2: OCR vía tesseract.js. pdf-to-img convierte cada página a PNG.
  try {
    const ocrText = await runOcr(buffer)
    // Si el OCR rindió menos que el texto nativo (PDF legible con force),
    // conservar el mejor de los dos.
    if (ocrText.replace(/\s/g, '').length < meaningful) {
      return { text, ocrUsed: false, pages }
    }
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

  // Escala adaptativa: buffers grandes (scans de alta resolución) se rasterizan
  // a menor escala para mantener el consumo de memoria por página acotado.
  const scale = buffer.length > 6 * 1024 * 1024 ? 1.2 : 1.5
  const document = await pdf(buffer, { scale })
  const worker = await createWorker('eng', undefined, {
    // Silencia logs de tesseract por defecto
    logger: () => {},
  })

  try {
    const pieces: string[] = []
    let pageCount = 0
    for await (const image of document) {
      if (++pageCount > MAX_OCR_PAGES) {
        console.warn(`[pdf-ocr] OCR limitado a ${MAX_OCR_PAGES} páginas (doc tiene más)`)
        break
      }
      // Timeout por página: una página dañada no puede colgar la petición entera.
      const recognize = worker.recognize(image).then(r => r.data.text || '')
      const timeout = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error(`OCR timeout página ${pageCount}`)), PER_PAGE_TIMEOUT_MS))
      try {
        pieces.push(await Promise.race([recognize, timeout]))
      } catch (e) {
        console.warn('[pdf-ocr]', e instanceof Error ? e.message : e)
        break // worker posiblemente colgado: no seguir con más páginas
      }
    }
    return pieces.join('\n')
  } finally {
    try { await worker.terminate() } catch { /* worker abortado: ignorar */ }
  }
}
