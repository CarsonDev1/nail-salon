import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loading, PageHeader } from '@/components/PageHeader'
import { formatMoney, minutesSince, subtotal } from '@/lib/format'
import { usePermissions } from '@/lib/profile'
import { useOpenTickets, useTables } from '@/lib/queries'
import { useSb } from '@/lib/supabase'
import type { SalonTable, Ticket } from '@/lib/types'
import { cn } from '@/lib/utils'

function OpenTableDialog({ table, onClose }: { table: SalonTable | null; onClose: () => void }) {
  const { t: tr } = useTranslation()
  const sb = useSb()
  const qc = useQueryClient()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const open = useMutation({
    mutationFn: async () => {
      const { data, error } = await sb.rpc('open_ticket', {
        p_table_id: table!.id,
        p_customer_name: name.trim() || null,
        p_customer_phone: phone.trim() || null,
      })
      if (error) throw error
      return data as Ticket
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['open-tickets'] })
      const id = table!.id
      setName('')
      setPhone('')
      onClose()
      nav(`/table/${id}`)
    },
  })

  return (
    <Dialog open={!!table} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl">{tr('floor.openTitle', { name: table?.name })}</DialogTitle>
          <DialogDescription className="text-base">{tr('floor.openHint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cn" className="text-base">{tr('floor.customerName')}</Label>
            <Input id="cn" value={name} onChange={(e) => setName(e.target.value)} placeholder={tr('floor.namePlaceholder')} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp" className="text-base">{tr('floor.phone')}</Label>
            <Input id="cp" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx xxx xxx" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="lg" onClick={onClose}>{tr('common.back')}</Button>
          <Button size="lg" disabled={open.isPending} onClick={() => open.mutate()}>{tr('floor.open')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function TablesPage() {
  const { t: tr } = useTranslation()
  const nav = useNavigate()
  const { canCashier } = usePermissions()
  const tables = useTables()
  const open = useOpenTickets()
  const [opening, setOpening] = useState<SalonTable | null>(null)

  if (tables.isLoading || open.isLoading) return <Loading />

  const byTable = new Map<string, Ticket>((open.data ?? []).map((t) => [t.table_id, t]))
  const list = (tables.data ?? []).filter((t) => t.active)
  const busyCount = list.filter((t) => byTable.has(t.id)).length

  const onPick = (t: SalonTable) => {
    if (byTable.has(t.id)) return nav(`/table/${t.id}`)
    if (!canCashier) return void toast.info(tr('floor.freeInfo'))
    setOpening(t)
  }

  return (
    <>
      <PageHeader
        title={tr('floor.title')}
        subtitle={tr('floor.subtitle', { busy: busyCount, free: list.length - busyCount })}
      />
      {list.length === 0 && <p className="text-lg text-muted-foreground">{tr('floor.empty')}</p>}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((t) => {
          const ticket = byTable.get(t.id)
          return (
            <button
              key={t.id}
              onClick={() => onPick(t)}
              className={cn(
                'flex min-h-36 min-w-0 flex-col justify-between gap-3 rounded-2xl border-2 p-3.5 text-left shadow-sm transition active:scale-[0.97] sm:min-h-44 sm:p-5',
                ticket
                  ? 'border-amber-400 bg-amber-50 hover:bg-amber-100'
                  : 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-xl font-bold sm:text-2xl">{t.name}</span>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-semibold sm:px-3 sm:py-1 sm:text-sm',
                    ticket ? 'bg-amber-400 text-amber-950' : 'bg-emerald-500 text-white',
                  )}
                >
                  {ticket ? tr('floor.inService') : tr('floor.free')}
                </span>
              </div>
              {ticket ? (
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 text-base font-medium sm:gap-2 sm:text-lg">
                    <Users className="size-4 shrink-0 sm:size-5" />
                    <span className="truncate">{ticket.customer_name || tr('common.guest')}</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-sm leading-snug text-muted-foreground sm:gap-2 sm:text-base">
                    <Clock className="mt-0.5 size-4 shrink-0 sm:size-5" />
                    <span>{tr('floor.meta', { min: minutesSince(ticket.opened_at), count: ticket.ticket_items.length })}</span>
                  </div>
                  <div className="text-xl font-bold text-amber-900 sm:text-2xl">{formatMoney(subtotal(ticket.ticket_items))}</div>
                </div>
              ) : (
                <div className="text-base text-emerald-800 sm:text-lg">{canCashier ? tr('floor.tapToOpen') : tr('floor.noCustomer')}</div>
              )}
            </button>
          )
        })}
      </div>
      <OpenTableDialog table={opening} onClose={() => setOpening(null)} />
    </>
  )
}
