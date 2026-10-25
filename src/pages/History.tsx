import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Loading, PageHeader } from '@/components/PageHeader'
import { addDays, formatDate, formatDayKey, formatMoney, formatTime, startOfDayInZone, subtotal, todayKey } from '@/lib/format'
import { useStaff } from '@/lib/queries'
import { useSb } from '@/lib/supabase'
import type { Ticket } from '@/lib/types'

export default function History() {
  const { t: tr } = useTranslation()
  const sb = useSb()
  const staff = useStaff()
  const [day, setDay] = useState(todayKey())
  const [selected, setSelected] = useState<Ticket | null>(null)

  const q = useQuery({
    queryKey: ['paid-tickets', 'day', day],
    queryFn: async () => {
      // "a day" = midnight to midnight in the salon's time zone
      const start = startOfDayInZone(day)
      const end = startOfDayInZone(addDays(day, 1))
      const { data, error } = await sb
        .from('tickets')
        .select('*, ticket_items(*), salon_tables(name)')
        .in('status', ['paid', 'cancelled'])
        .gte('opened_at', start.toISOString())
        .lt('opened_at', end.toISOString())
        .order('opened_at', { ascending: false })
      if (error) throw error
      return data as Ticket[]
    },
  })

  const shift = (n: number) => setDay(addDays(day, n))

  const list = q.data ?? []
  const paid = list.filter((t) => t.status === 'paid')
  const revenue = paid.reduce((s, t) => s + t.total, 0)
  const techName = (id: string | null) => staff.data?.find((p) => p.id === id)?.full_name ?? tr('common.noTechnician')

  return (
    <>
      <PageHeader
        title={tr('history.title')}
        subtitle={tr('history.subtitle', { date: formatDayKey(day), count: paid.length, amount: formatMoney(revenue) })}
        actions={
          <>
            <Button variant="outline" size="icon" aria-label={tr('history.prev')} onClick={() => shift(-1)}><ChevronLeft /></Button>
            <Input type="date" className="min-w-0 flex-1 sm:w-48 sm:flex-none" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
            <Button variant="outline" size="icon" aria-label={tr('history.next')} onClick={() => shift(1)}><ChevronRight /></Button>
            <Button variant="outline" className="max-sm:w-full" onClick={() => setDay(todayKey())}>{tr('history.today')}</Button>
          </>
        }
      />

      {q.isLoading ? (
        <Loading />
      ) : list.length === 0 ? (
        <p className="rounded-2xl border bg-background p-8 text-center text-lg text-muted-foreground">{tr('history.none')}</p>
      ) : (
        <div className="divide-y rounded-2xl border bg-background">
          {list.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 p-3.5 text-left hover:bg-muted/50 active:bg-muted sm:gap-x-4 sm:p-4"
            >
              <div className="row-span-2 self-start text-base font-semibold sm:w-16 sm:text-lg">{formatTime(t.paid_at ?? t.opened_at)}</div>
              <div className="truncate text-base font-semibold sm:text-lg">
                {t.salon_tables?.name} · {t.customer_name || tr('common.guest')}
              </div>
              {t.status === 'cancelled' ? (
                <Badge variant="destructive" className="row-span-2">{tr('history.cancelled')}</Badge>
              ) : (
                <div className="text-right text-lg font-bold text-primary sm:text-xl">{formatMoney(t.total)}</div>
              )}
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm text-muted-foreground">{t.ticket_items.map((i) => `${i.name} x${i.qty}`).join(', ')}</span>
              </div>
              {t.status !== 'cancelled' && (
                <Badge variant="secondary" className="justify-self-end">{t.payment_method ? tr(`method.${t.payment_method}`) : ''}</Badge>
              )}
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selected.salon_tables?.name} · {selected.customer_name || tr('common.guest')}</DialogTitle>
                <DialogDescription className="text-base">
                  {formatDate(selected.opened_at)} · {formatTime(selected.opened_at)}
                  {selected.customer_phone ? ` · ${selected.customer_phone}` : ''}
                </DialogDescription>
              </DialogHeader>
              <div className="divide-y rounded-xl border">
                {selected.ticket_items.map((i) => (
                  <div key={i.id} className="flex justify-between gap-3 p-3">
                    <div>
                      <div className="font-semibold">{i.name} <span className="text-muted-foreground">x{i.qty}</span></div>
                      <div className="text-sm text-muted-foreground">{techName(i.technician_id)}</div>
                    </div>
                    <div className="font-bold">{formatMoney(i.price * i.qty)}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-base">
                <div className="flex justify-between"><span>{tr('bill.subtotal')}</span><span>{formatMoney(subtotal(selected.ticket_items))}</span></div>
                {selected.discount > 0 && <div className="flex justify-between"><span>{tr('bill.discount')}</span><span>- {formatMoney(selected.discount)}</span></div>}
                {selected.tip > 0 && <div className="flex justify-between"><span>{tr('bill.tip')}</span><span>+ {formatMoney(selected.tip)}</span></div>}
                {selected.status === 'paid' ? (
                  <div className="flex justify-between pt-1 text-2xl font-bold text-primary">
                    <span>{tr('history.totalWith', { method: selected.payment_method ? tr(`method.${selected.payment_method}`) : '' })}</span>
                    <span>{formatMoney(selected.total)}</span>
                  </div>
                ) : (
                  <Badge variant="destructive">{tr('history.billCancelled')}</Badge>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
