/**
 * UUID v4 generator with safe fallback for non-secure contexts.
 *
 * `crypto.randomUUID()` is only available in secure contexts (HTTPS or localhost).
 * When the app is served over plain HTTP (e.g., `http://192.168.x.x:5173`), the
 * API is missing and every id-generating action throws.
 *
 * Priority:
 *   1. crypto.randomUUID() — secure context, native RFC 4122 v4
 *   2. crypto.getRandomValues() + manual v4 assembly — available in HTTP contexts
 *      since all modern browsers expose the Web Crypto API getRandomValues path
 *      regardless of secure-context status
 *   3. Math.random() fallback — last resort; not cryptographically secure but
 *      sufficient for client-side local-only row ids (no security boundary here)
 */

export function uuid(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }

    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16)
      crypto.getRandomValues(bytes)
      // Per RFC 4122 section 4.4: set version (v4) and variant (10xx) bits
      bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
      bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
      const hex: string[] = []
      for (let i = 0; i < 16; i++) {
        hex.push((bytes[i] ?? 0).toString(16).padStart(2, '0'))
      }
      return (
        hex.slice(0, 4).join('') + '-' +
        hex.slice(4, 6).join('') + '-' +
        hex.slice(6, 8).join('') + '-' +
        hex.slice(8, 10).join('') + '-' +
        hex.slice(10, 16).join('')
      )
    }
  }

  // Pure-JS fallback (should almost never execute — only in exotic embedded runtimes)
  const rnd = () => Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0')
  const v4 = (rnd() + rnd() + rnd() + rnd()).split('')
  v4[12] = '4'
  v4[16] = ((parseInt(v4[16] ?? '0', 16) & 0x3) | 0x8).toString(16)
  return (
    v4.slice(0, 8).join('') + '-' +
    v4.slice(8, 12).join('') + '-' +
    v4.slice(12, 16).join('') + '-' +
    v4.slice(16, 20).join('') + '-' +
    v4.slice(20, 32).join('')
  )
}
