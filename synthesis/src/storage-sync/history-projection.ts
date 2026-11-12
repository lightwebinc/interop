import { projectDataset, type Dataset, type Row } from './projection.js'

export const historyProjectionPolicy = 'tpnil-storage-history-projection@2.0.0' as const

/** UTC RFC3339 form supported by the pinned Go time parser. Fractional digits
 * remain strings: no Date, floating point, rounding or precision loss. */
export function normalizeHistoryTimestamp(value: unknown): string {
  if (typeof value !== 'string') throw new Error('History timestamp must be a UTC RFC3339 string')
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|\+00:00)$/.exec(value)
  if (!parts) throw new Error('History timestamp must be a UTC RFC3339 string')
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = '', zone] = parts
  const year = Number(yearText), month = Number(monthText), day = Number(dayText)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]! || Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText) > 59) throw new Error('History timestamp has an invalid calendar date or time')
  const significant = fraction.replace(/0+$/, '')
  return `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:${secondText}${significant ? `.${significant}` : ''}${zone}`
}

/** Prospective v2 only. The v1 projection and every raw dataset stay unchanged. */
export function projectDatasetV2(dataset: Dataset): Record<string, unknown> {
  const projected = projectDataset(dataset)
  for (const row of projected.provenTxReqs as Row[]) {
    if (row.history === undefined) continue
    if (typeof row.history !== 'object' || row.history === null || Array.isArray(row.history)) throw new Error('History must be an object')
    const history = row.history as Row
    if (history.notes === undefined) continue
    if (!Array.isArray(history.notes)) throw new Error('History notes must be an array')
    for (const note of history.notes) {
      if (typeof note !== 'object' || note === null || Array.isArray(note)) throw new Error('History note must be an object')
      if (Object.hasOwn(note, 'when')) note.when = normalizeHistoryTimestamp(note.when)
    }
  }
  return projected
}
