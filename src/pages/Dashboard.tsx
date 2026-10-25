import { useTranslation } from 'react-i18next'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loading, PageHeader } from '@/components/PageHeader'
import { addDays, dayKey, formatMoney, formatMoneyCompact, startOfDayInZone, todayKey } from '@/lib/format'
import { useStaff } from '@/lib/queries'
import { useSb } from '@/lib/supabase'
import type { Ticket } from '@/lib/types'
import { useMediaQuery } from '@/lib/useMediaQuery'

type Range = 'today' | '7d' | '30d' | 'month'
const rangeKey: Record<Range, string> = {
  today: 'overview.range.today',
  '7d': 'overview.range.d7',
  '30d': 'overview.range.d30',
  month: 'overview.range.month',
}
const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

/** First calendar day (YYYY-MM-DD, salon time zone) of the selected range */
function rangeStartKey(r: Range) {
  const today = todayKey()
  if (r === '7d') return addDays(today, -6)
  if (r === '30d') return addDays(today, -29)
  if (r === 'month') return `${today.slice(0, 8)}01`
  return today
}

const moneyTip = (v: unknown) => formatMoney(Number(v))

export default function Dashboard() {
  const { t: tr } = useTranslation()
  const sb = useSb()
  const staff = useStaff()
  const [range, setRange] = useState<Range>('7d')
  const isSm = useMediaQuery('(min-width: 640px)')
  // Chart sizing: smaller text and a narrower label column on phones
  const tickSize = isSm ? 14 : 12
  const catWidth = isSm ? 130 : 86
  const shorten = (s: string) => (!isSm && s.length > 12 ? `${s.slice(0, 11)}…` : s)

  const q = useQuery({
    queryKey: ['paid-tickets', 'dash', range],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await sb
        .from('tickets')
        .select('*, ticket_items(*)')
        .eq('status', 'paid')
        .gte('paid_at', startOfDayInZone(rangeStartKey(range)).toISOString())
      if (error) throw error
      return data as Ticket[]
    },
  })

  const stats = useMemo(() => {
    const tickets = q.data ?? []
    const revenue = tickets.reduce((s, t) => s + t.total, 0)
    const tips = tickets.reduce((s, t) => s + t.tip, 0)

    // Revenue per day (includes days with zero revenue)
    const byDay = new Map<string, number>()
    for (let k = rangeStartKey(range), end = todayKey(); k <= end; k = addDays(k, 1)) byDay.set(k, 0)
    tickets.forEach((t) => {
      const k = dayKey(t.paid_at!)
      byDay.set(k, (byDay.get(k) ?? 0) + t.total)
    })
    const daily = [...byDay].map(([k, v]) => ({ label: `${+k.slice(5, 7)}/${+k.slice(8)}`, revenue: v }))

    const svc = new Map<string, { name: string; revenue: number; qty: number }>()
    const tech = new Map<string, number>()
    const methods = new Map<string, number>()
    tickets.forEach((t) => {
      methods.set(t.payment_method ?? '?', (methods.get(t.payment_method ?? '?') ?? 0) + t.total)
      t.ticket_items.forEach((i) => {
        const s = svc.get(i.name) ?? { name: i.name, revenue: 0, qty: 0 }
        s.revenue += i.price * i.qty
        s.qty += i.qty
        svc.set(i.name, s)
        const tn = staff.data?.find((p) => p.id === i.technician_id)?.full_name ?? tr('common.noTechnician')
        tech.set(tn, (tech.get(tn) ?? 0) + i.price * i.qty)
      })
    })

    return {
      revenue,
      tips,
      count: tickets.length,
      avg: tickets.length ? Math.round(revenue / tickets.length) : 0,
      daily,
      topServices: [...svc.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6),
      byTech: [...tech].map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue),
      byMethod: [...methods].map(([k, value]) => ({ name: k === '?' ? k : tr(`method.${k}`), value })),
    }
  }, [q.data, staff.data, range, tr])

  const tiles = [
    { label: tr('overview.revenue'), value: formatMoney(stats.revenue) },
    { label: tr('overview.bills'), value: String(stats.count) },
    { label: tr('overview.avg'), value: formatMoney(stats.avg) },
    { label: tr('overview.tips'), value: formatMoney(stats.tips) },
  ]

  return (
    <>
      <PageHeader
        title={tr('overview.title')}
        subtitle={tr('overview.subtitle')}
        actions={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            {(Object.keys(rangeKey) as Range[]).map((r) => (
              <Button
                key={r}
                size={isSm ? 'lg' : 'default'}
                className="min-w-0 px-3 sm:px-6"
                variant={r === range ? 'default' : 'outline'}
                onClick={() => setRange(r)}
              >
                <span className="truncate">{tr(rangeKey[r])}</span>
              </Button>
            ))}
          </div>
        }
      />

      {q.isLoading ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {tiles.map((t) => (
              <Card key={t.label} className="min-w-0">
                <CardContent className="space-y-1 pt-4 sm:pt-5">
                  <div className="truncate text-sm text-muted-foreground sm:text-base">{t.label}</div>
                  <div className="whitespace-nowrap text-lg font-bold text-primary sm:text-2xl">{t.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-xl">{tr('overview.byDay')}</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.daily}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: tickSize }} interval="preserveStartEnd" minTickGap={isSm ? 8 : 24} />
                  <YAxis tickFormatter={(v: number) => formatMoneyCompact(v)} tick={{ fontSize: tickSize }} width={isSm ? 56 : 48} />
                  <Tooltip formatter={moneyTip} labelFormatter={(l) => tr('overview.day', { label: l })} />
                  <Bar dataKey="revenue" name={tr('overview.revenue')} fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-xl">{tr('overview.topServices')}</CardTitle></CardHeader>
              <CardContent className="h-72">
                {stats.topServices.length === 0 ? <Empty /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.topServices} layout="vertical" margin={{ left: 0, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v: number) => formatMoneyCompact(v)} tick={{ fontSize: tickSize }} />
                      <YAxis type="category" dataKey="name" width={catWidth} tick={{ fontSize: tickSize }} tickFormatter={shorten} />
                      <Tooltip formatter={moneyTip} />
                      <Bar dataKey="revenue" name={tr('overview.revenue')} fill="var(--chart-2)" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-xl">{tr('overview.byTech')}</CardTitle></CardHeader>
              <CardContent className="h-72">
                {stats.byTech.length === 0 ? <Empty /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.byTech} layout="vertical" margin={{ left: 0, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v: number) => formatMoneyCompact(v)} tick={{ fontSize: tickSize }} />
                      <YAxis type="category" dataKey="name" width={catWidth} tick={{ fontSize: tickSize }} tickFormatter={shorten} />
                      <Tooltip formatter={moneyTip} />
                      <Bar dataKey="revenue" name={tr('overview.revenue')} fill="var(--chart-4)" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-xl">{tr('overview.methods')}</CardTitle></CardHeader>
            <CardContent className="h-64">
              {stats.byMethod.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.byMethod} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} cy="45%">
                      {stats.byMethod.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 15 }} />
                    <Tooltip formatter={moneyTip} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}

function Empty() {
  const { t: tr } = useTranslation()
  return <div className="grid h-full place-items-center text-lg text-muted-foreground">{tr('overview.noData')}</div>
}
