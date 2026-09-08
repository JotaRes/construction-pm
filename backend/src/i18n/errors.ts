/**
 * TRADUCCIÓN DE ERRORES DE LA API — Restrepo Acosta Global Holding LLC
 * ─────────────────────────────────────────────────────────────────────────────
 * El frontend muestra `error` tal cual en un toast:
 *
 *     toast.error(e.response?.data?.error || t('common.saveError'))
 *
 * Así que un mensaje en español se colaba en la interfaz en inglés. En vez de
 * reescribir las ~40 rutas para que devuelvan códigos, se traduce la respuesta
 * en un solo punto: el middleware de abajo. Las rutas siguen escribiendo su
 * mensaje en español y este archivo es la única lista que hay que mantener.
 *
 * El idioma llega en la cabecera `Accept-Language`, que el cliente axios del
 * frontend fija con el idioma activo.
 */
import type { Request, Response, NextFunction } from 'express'

/** Mensaje en español (tal como lo escribe la ruta) → inglés. */
const EN: Record<string, string> = {
  'Budget line no encontrada en este proyecto': 'Budget line not found on this project',
  'Change order no encontrado': 'Change order not found',
  'Cloudinary no configurado': 'Cloudinary is not configured',
  'Contraseña incorrecta': 'Incorrect password',
  'Contraseña incorrecta. El reseteo fue bloqueado por seguridad.':
    'Incorrect password. The reset was blocked for security.',
  'Contraseña incorrecta. El restore fue bloqueado por seguridad.':
    'Incorrect password. The restore was blocked for security.',
  'Contraseña requerida': 'Password required',
  'Demasiados intentos. Espera 15 minutos e intenta de nuevo.':
    'Too many attempts. Wait 15 minutes and try again.',
  'Draw no encontrado': 'Draw not found',
  'Draw no pertenece a este proyecto': 'Draw does not belong to this project',
  'El ZIP no contiene data/tech-database.json': 'The ZIP does not contain data/tech-database.json',
  'El proveedor no existe': 'The vendor does not exist',
  'El snapshot está corrupto o vacío': 'The snapshot is corrupted or empty',
  'El snapshot no contiene proyectos del módulo técnico':
    'The snapshot contains no technical module projects',
  'Este draw no tiene PDF de aprobación cargado': 'This draw has no approval PDF uploaded',
  'Indica quién toma la decisión (approvedBy)': 'Specify who makes the decision (approvedBy)',
  'La línea del budget no existe': 'The budget line does not exist',
  'No hay Excel del lender cargado. Súbelo primero en esta sección.':
    'No lender Excel uploaded. Upload it first in this section.',
  'No hay campos editables en el payload': 'No editable fields in the payload',
  'No se detectaron line items en el PDF (ni siquiera con OCR). Verifica que sea el reporte de Trinity.':
    'No line items were detected in the PDF (not even with OCR). Check that it is the Trinity report.',
  'No se subió archivo': 'No file uploaded',
  'No se subió ningún archivo': 'No file uploaded',
  'Pago no encontrado': 'Payment not found',
  'Proyecto no encontrado': 'Project not found',
  'Solo imágenes (JPG, PNG, WebP, HEIC)': 'Images only (JPG, PNG, WebP, HEIC)',
  'Subactividad no encontrada': 'Subactivity not found',
  'Un CO aprobado/rechazado no se puede modificar en monto o días. Crea un CO nuevo.':
    'An approved/rejected CO cannot change its amount or days. Create a new CO.',
  'decision debe ser APROBADO o RECHAZADO': 'decision must be APROBADO or RECHAZADO',
  'drawId requerido para aplicar approvals': 'drawId is required to apply approvals',
  'Archivo requerido': 'File required',
  'Archivo o nombre requerido': 'File or name required',
  'Nombre requerido': 'Name required',
}

/** `true` si el cliente pidió inglés. Por defecto español (idioma de la firma). */
function wantsEnglish(req: Request): boolean {
  const header = String(req.headers['accept-language'] ?? '')
  return /^en\b/i.test(header.trim())
}

/**
 * Traduce el campo `error` de cualquier respuesta JSON. Se monta ANTES de las
 * rutas: envuelve `res.json` una sola vez y no toca ningún handler.
 *
 * Un mensaje que no esté en el mapa sale intacto — es preferible mostrar el
 * texto original que un hueco.
 */
export function translateApiErrors(req: Request, res: Response, next: NextFunction) {
  if (!wantsEnglish(req)) return next()

  const original = res.json.bind(res)
  res.json = (body: any) => {
    if (body && typeof body === 'object' && typeof body.error === 'string') {
      const translated = EN[body.error]
      if (translated) body = { ...body, error: translated }
    }
    return original(body)
  }
  next()
}
