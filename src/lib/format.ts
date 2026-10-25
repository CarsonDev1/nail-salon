import { salonTimeZone as TZ } from './env'
import type { TicketItem } from './types'

/* ---------- Money: US dollars ---------- */

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/** All amounts are stored as integer cents (3500 = $35.00). */
export const formatMoney = (cents: number) => usd.format(cents / 100)

/** Compact dollars for chart axes: $950, $1.5k, $2.3M */
export const formatMoneyCompact = (cents: number) => {
  const d = cents / 100
  if (d >= 1e6) return `$${+(d / 1e6).toFixed(1)}M`
  if (d >= 1e3) return `$${+(d / 1e3).toFixed(1)}k`
  return `$${Math.round(d)}`
}

/* ---------- Dates & times: US format, in the salon's time zone ---------- */

const dateFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: '2-digit', day: '2-digit', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const wallFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
})

/** 10/25/2026 */
export const formatDate = (d: string | Date) => dateFmt.format(new Date(d))

/** 2:35 PM */
export const formatTime = (d: string | Date) => timeFmt.format(new Date(d))

/** "PDT", "EST"… — the zone abbreviation right now */
export const timeZoneAbbr = () =>
  new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'short' })
    .formatToParts(new Date())
    .find((p) => p.type === 'timeZoneName')?.value ?? TZ

/** YYYY-MM-DD of an instant, as the calendar date in the salon's time zone */
export const dayKey = (d: string | Date) => keyFmt.format(new Date(d))

export const todayKey = () => dayKey(new Date())

/** Calendar math on YYYY-MM-DD keys (no time zone involved) */
export const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** 2026-10-25 → 10/25/2026 */
export const formatDayKey = (key: string) => {
  const [y, m, d] = key.split('-')
  return `${m}/${d}/${y}`
}

/** Offset (ms) of the salon time zone from UTC at a given instant; negative in the US. */
function zoneOffsetMs(at: Date) {
  const v = Object.fromEntries(wallFmt.formatToParts(at).map((p) => [p.type, Number(p.value)]))
  const wallAsUtc = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second)
  return wallAsUtc - Math.floor(at.getTime() / 1000) * 1000
}

/** The instant a calendar day begins (00:00) in the salon's time zone; handles daylight saving. */
export const startOfDayInZone = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  const wall = Date.UTC(y, m - 1, d)
  let t = wall - zoneOffsetMs(new Date(wall))
  t = wall - zoneOffsetMs(new Date(t)) // refine once across a daylight-saving change
  return new Date(t)
}

export const minutesSince = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))

export const subtotal = (items: Pick<TicketItem, 'price' | 'qty'>[]) =>
  items.reduce((s, i) => s + i.price * i.qty, 0)
