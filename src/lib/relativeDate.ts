/** Returns a human-readable relative date string in Russian. */
export function relativeDate(timestamp: number): string {
  const diffMs = Date.now() - timestamp
  const days = Math.floor(diffMs / 86_400_000)

  if (days === 0) return 'сегодня'
  if (days === 1) return 'вчера'
  if (days < 7) {
    const m10 = days % 10
    const m100 = days % 100
    const suffix =
      m10 === 1 && m100 !== 11 ? 'день' :
      m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? 'дня' : 'дней'
    return `${days} ${suffix} назад`
  }
  return new Date(timestamp).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}
