/**
 * Phase 07 — TTF font loader for jsPDF.
 *
 * Vite serves TTF files as URL assets. On first export we fetch them, base64-encode
 * once, and cache the result. Subsequent exports reuse the cached strings.
 */

import robotoRegularUrl from '../fonts/Roboto-Regular.ttf?url'
import robotoBoldUrl from '../fonts/Roboto-Bold.ttf?url'
import dejavuRegularUrl from '../fonts/DejaVuSerif.ttf?url'
import dejavuBoldUrl from '../fonts/DejaVuSerif-Bold.ttf?url'
import type { ExportFontFamily } from '../types'

export interface LoadedFontFamily {
  readonly jsName: string                // как зарегистрировать в jsPDF (semantic name)
  readonly regularBase64: string
  readonly boldBase64: string
}

interface FontSource {
  readonly regularUrl: string
  readonly boldUrl: string
  readonly jsName: string
  readonly label: string
}

export const FONT_SOURCES: Record<ExportFontFamily, FontSource> = {
  roboto: {
    regularUrl: robotoRegularUrl,
    boldUrl: robotoBoldUrl,
    jsName: 'Roboto',
    label: 'Roboto (sans-serif)'
  },
  gost: {
    regularUrl: dejavuRegularUrl,
    boldUrl: dejavuBoldUrl,
    jsName: 'DejaVuSerif',
    label: 'DejaVu Serif (заместитель ГОСТ 2.304)'
  }
}

const cache = new Map<string, string>()

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize))
    )
  }
  return btoa(binary)
}

async function fetchBase64(url: string): Promise<string> {
  const cached = cache.get(url)
  if (cached) return cached
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Не удалось загрузить шрифт: ${url}`)
  const buf = await res.arrayBuffer()
  const b64 = arrayBufferToBase64(buf)
  cache.set(url, b64)
  return b64
}

export async function loadFontFamily(family: ExportFontFamily): Promise<LoadedFontFamily> {
  const src = FONT_SOURCES[family]
  const [regularBase64, boldBase64] = await Promise.all([
    fetchBase64(src.regularUrl),
    fetchBase64(src.boldUrl)
  ])
  return { jsName: src.jsName, regularBase64, boldBase64 }
}
