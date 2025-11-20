// utils/timeUtils.ts

/**
 * Convert Postgres interval string to seconds
 * Accepts formats like "00:31:12.45", "31:12", "00:31:12"
 */
export function intervalToSeconds(intervalStr: string | null): number {
  if (!intervalStr) return Number.POSITIVE_INFINITY
  // try HH:MM:SS(.ms) or MM:SS(.ms)
  const parts = intervalStr.split(':')
  let h = 0, m = 0, s = 0
  if (parts.length === 3) {
    h = parseInt(parts[0], 10) || 0
    m = parseInt(parts[1], 10) || 0
    s = parseFloat(parts[2]) || 0
  } else if (parts.length === 2) {
    m = parseInt(parts[0], 10) || 0
    s = parseFloat(parts[1]) || 0
  } else {
    const n = parseFloat(intervalStr)
    return isNaN(n) ? Number.POSITIVE_INFINITY : n
  }
  return h * 3600 + m * 60 + s
}

/**
 * Format seconds to HH:MM:SS.ms or MM:SS.ms string
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const ss = s.toFixed(2).padStart(5, '0') // "05.23"
  if (h > 0) return `${String(h)}:${String(m).padStart(2,'0')}:${ss}`
  return `${String(m)}:${ss}`
}
