import i18n from '@/i18n'
import type { TicketItem } from './types'

/** Dates follow the selected UI language. Money is always US dollars. */
const dateLocale = () => (i18n.language.startsWith('vi') ? 'vi-VN' : 'en-GB')

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

export const formatDate = (d: string | Date) =>
  new Intl.DateTimeFormat(dateLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))

export const formatTime = (d: string | Date) =>
  new Intl.DateTimeFormat(dateLocale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(d))

/** YYYY-MM-DD in local time */
export const dayKey = (d: string | Date) => {
  const x = new Date(d)
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${x.getFullYear()}-${m}-${day}`
}

export const minutesSince = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))

export const subtotal = (items: Pick<TicketItem, 'price' | 'qty'>[]) =>
  items.reduce((s, i) => s + i.price * i.qty, 0)
