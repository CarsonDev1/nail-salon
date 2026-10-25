import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Banknote, ChevronRight, CreditCard, Landmark, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { MoneyInput } from '@/components/MoneyInput'
import { Loading } from '@/components/PageHeader'
import { formatMoney, subtotal } from '@/lib/format'
import { usePermissions } from '@/lib/profile'
import { useOpenTickets, useServices, useStaff, useTables } from '@/lib/queries'
import { useSb } from '@/lib/supabase'
import type { PaymentMethod, Service, Ticket } from '@/lib/types'
import { useIsDesktop } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'

const NONE = 'none'
const ALL = '__all__'
const methodIcon: Record<PaymentMethod, typeof Banknote> = { cash: Banknote, transfer: Landmark, card: CreditCard }
const methodTint: Record<PaymentMethod, string> = {
  cash: 'bg-emerald-100 text-emerald-700',
  transfer: 'bg-sky-100 text-sky-700',
  card: 'bg-violet-100 text-violet-700',
}

function TicketView({ ticket, tableName, busyAt }: { ticket: Ticket; tableName: string; busyAt: Map<string, string> }) {
  const { t: tr } = useTranslation()
  const sb = useSb()
  const qc = useQueryClient()
  const nav = useNavigate()
  const isDesktop = useIsDesktop()
  const { canCashier } = usePermissions()
  const services = useServices()
  const staff = useStaff()

  const [category, setCategory] = useState(ALL)
  // The technician picked at the top is remembered per bill, so leaving and coming back keeps it.
  // First visit: reuse the technician already on the bill when it is the same person on every line.
  const techKey = `nail:tech:${ticket.id}`
  const [currentTech, setCurrentTech] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(techKey)
      if (saved) return saved
    } catch {
      /* storage unavailable */
    }
    const onBill = new Set(ticket.ticket_items.map((i) => i.technician_id).filter(Boolean))
    return onBill.size === 1 ? [...onBill][0]! : NONE
  })
  const pickTech = (id: string) => {
    setCurrentTech(id)
    try {
      localStorage.setItem(techKey, id)
    } catch {
      /* storage unavailable */
    }
  }
  const [name, setName] = useState(ticket.customer_name ?? '')
  const [phone, setPhone] = useState(ticket.customer_phone ?? '')
  const [discount, setDiscount] = useState(ticket.discount)
  const [tip, setTip] = useState(ticket.tip)
  const [payOpen, setPayOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [billOpen, setBillOpen] = useState(false)

  // When another device edits name/phone, sync it (only runs when the server value changes, so typing is not overwritten)
  useEffect(() => {
    setName(ticket.customer_name ?? '')
    setPhone(ticket.customer_phone ?? '')
  }, [ticket.customer_name, ticket.customer_phone])

  const technicians = (staff.data ?? []).filter((p) => p.active && p.role !== 'pending')

  // If the technician picked at the top becomes busy elsewhere, drop the selection
  useEffect(() => {
    if (currentTech !== NONE && busyAt.has(currentTech)) pickTech(NONE)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busyAt, currentTech])
  const techName = (id: string | null) => technicians.find((t) => t.id === id)?.full_name ?? ''
  const activeServices = useMemo(() => (services.data ?? []).filter((s) => s.active), [services.data])
  const categories = useMemo(() => [ALL, ...Array.from(new Set(activeServices.map((s) => s.category)))], [activeServices])
  const shown = category === ALL ? activeServices : activeServices.filter((s) => s.category === category)

  const items = ticket.ticket_items
  const sub = subtotal(items)
  const disc = Math.min(discount, sub)
  const total = sub - disc + tip
  const itemCount = items.reduce((s, i) => s + i.qty, 0)
  const qtyByService = useMemo(() => {
    const m = new Map<string, number>()
    items.forEach((i) => i.service_id && m.set(i.service_id, (m.get(i.service_id) ?? 0) + i.qty))
    return m
  }, [items])

  const refresh = () => qc.invalidateQueries({ queryKey: ['open-tickets'] })

  const addItem = useMutation({
    mutationFn: async (svc: Service) => {
      const techId = currentTech === NONE ? null : currentTech
      const same = items.find((i) => i.service_id === svc.id && i.technician_id === techId)
      if (same) {
        const { error } = await sb.from('ticket_items').update({ qty: same.qty + 1 }).eq('id', same.id)
        if (error) throw error
      } else {
        const { error } = await sb.from('ticket_items').insert({
          ticket_id: ticket.id,
          service_id: svc.id,
          name: svc.name,
          price: svc.price,
          qty: 1,
          technician_id: techId,
        })
        if (error) throw error
      }
    },
    onSuccess: refresh,
  })

  const patchItem = useMutation({
    mutationFn: async (v: { id: string; patch: { qty?: number; technician_id?: string | null } }) => {
      const { error } = await sb.from('ticket_items').update(v.patch).eq('id', v.id)
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('ticket_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const saveCustomer = useMutation({
    mutationFn: async () => {
      const { error } = await sb
        .from('tickets')
        .update({ customer_name: name.trim() || null, customer_phone: phone.trim() || null })
        .eq('id', ticket.id)
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const pay = useMutation({
    mutationFn: async (method: PaymentMethod) => {
      const { error } = await sb.rpc('pay_ticket', {
        p_ticket_id: ticket.id,
        p_method: method,
        p_discount: disc,
        p_tip: tip,
      })
      if (error) throw error
    },
    onSuccess: async () => {
      toast.success(tr('bill.paid'))
      setPayOpen(false)
      await Promise.all([refresh(), qc.invalidateQueries({ queryKey: ['paid-tickets'] })])
      nav('/')
    },
  })

  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await sb.rpc('cancel_ticket', { p_ticket_id: ticket.id })
      if (error) throw error
    },
    onSuccess: async () => {
      toast.success(tr('bill.cancelled'))
      setCancelOpen(false)
      await refresh()
      nav('/')
    },
  })

  const techSelectItems = (
    <>
      <SelectItem value={NONE}>{tr('common.noTechnician')}</SelectItem>
      {technicians.map((t) => {
        const busy = busyAt.get(t.id)
        return (
          <SelectItem key={t.id} value={t.id} disabled={!!busy}>
            {t.full_name}
            {busy ? ` · ${tr('bill.busyAt', { table: busy })}` : ''}
          </SelectItem>
        )
      })}
    </>
  )

  /** The bill itself. On phones it lives in a bottom sheet; on desktop it is the right-hand column. */
  const renderBill = (inSheet: boolean) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="n" className="text-sm">{tr('bill.customerName')}</Label>
          <Input
            id="n"
            value={name}
            disabled={!canCashier}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => canCashier && saveCustomer.mutate()}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor="p" className="text-sm">{tr('bill.phone')}</Label>
          <Input
            id="p"
            inputMode="tel"
            value={phone}
            disabled={!canCashier}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => canCashier && saveCustomer.mutate()}
          />
        </div>
      </div>

      <div className="divide-y rounded-xl border">
        {items.length === 0 && <div className="p-4 text-center text-base text-muted-foreground">{tr('bill.empty')}</div>}
        {items.map((i) => (
          <div key={i.id} className="space-y-2.5 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 font-semibold leading-snug">{i.name}</div>
              <div className="shrink-0 font-bold">{formatMoney(i.price * i.qty)}</div>
            </div>
            {canCashier ? (
              <>
                <Select
                  value={i.technician_id ?? NONE}
                  onValueChange={(v) => patchItem.mutate({ id: i.id, patch: { technician_id: v === NONE ? null : v } })}
                >
                  <SelectTrigger size="sm" className="w-full min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>{techSelectItems}</SelectContent>
                </Select>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon-sm"
                      variant="outline"
                      aria-label={tr('bill.decrease')}
                      disabled={i.qty <= 1}
                      onClick={() => patchItem.mutate({ id: i.id, patch: { qty: i.qty - 1 } })}
                    >
                      <Minus />
                    </Button>
                    <span className="w-8 text-center text-xl font-bold">{i.qty}</span>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      aria-label={tr('bill.increase')}
                      onClick={() => patchItem.mutate({ id: i.id, patch: { qty: i.qty + 1 } })}
                    >
                      <Plus />
                    </Button>
                  </div>
                  <Button size="icon-sm" variant="destructive" aria-label={tr('bill.remove')} onClick={() => removeItem.mutate(i.id)}>
                    <Trash2 />
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                {techName(i.technician_id) || tr('common.noTechnician')} · {tr('bill.qty', { count: i.qty })}
              </div>
            )}
          </div>
        ))}
      </div>

      {canCashier && (
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="d" className="text-sm">{tr('bill.discountInput')}</Label>
            <MoneyInput id="d" value={discount} onChange={setDiscount} />
          </div>
          <div className="min-w-0 space-y-1">
            <Label htmlFor="t" className="text-sm">{tr('bill.tipInput')}</Label>
            <MoneyInput id="t" value={tip} onChange={setTip} />
          </div>
        </div>
      )}

      <div
        className={cn(
          'space-y-3 border-t pt-3',
          inSheet && 'sticky bottom-0 -mx-4 -mb-4 bg-popover px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]',
        )}
      >
        <div className="space-y-1 text-base">
          <div className="flex justify-between">
            <span>{tr('bill.subtotal')}</span>
            <span>{formatMoney(sub)}</span>
          </div>
          {disc > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{tr('bill.discount')}</span>
              <span>- {formatMoney(disc)}</span>
            </div>
          )}
          {tip > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{tr('bill.tip')}</span>
              <span>+ {formatMoney(tip)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between pt-1 text-2xl font-bold text-primary">
            <span>{tr('bill.total')}</span>
            <span>{formatMoney(total)}</span>
          </div>
        </div>

        {canCashier && (
          <div className="grid gap-2">
            <Button size="lg" className="h-16 text-xl" disabled={items.length === 0} onClick={() => setPayOpen(true)}>
              {tr('bill.pay')}
            </Button>
            <Button variant="destructive" onClick={() => setCancelOpen(true)}>
              {tr('bill.cancelBill')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      <div className="mb-4 flex items-center gap-3 sm:mb-5">
        <Button asChild variant="outline" className="max-sm:w-12 max-sm:px-0">
          <Link to="/" aria-label={tr('bill.back')}>
            <ArrowLeft />
            <span className="hidden sm:inline">{tr('bill.back')}</span>
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold sm:text-3xl">{tableName}</h1>
          {(ticket.customer_name || name) && (
            <p className="truncate text-base text-muted-foreground lg:hidden">{name || ticket.customer_name}</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
        {/* Pick services */}
        <section className="min-w-0 space-y-4">
          {canCashier ? (
            <>
              <div className="space-y-2 rounded-2xl border bg-background p-3 sm:flex sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1 sm:space-y-0 sm:p-4">
                <Label className="text-base font-semibold">{tr('bill.technician')}</Label>
                <Select value={currentTech} onValueChange={pickTech}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>{techSelectItems}</SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground sm:basis-full">{tr('bill.pickTech')}</p>
              </div>

              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                {categories.map((c) => (
                  <Button
                    key={c}
                    variant={c === category ? 'default' : 'outline'}
                    className="shrink-0"
                    onClick={() => setCategory(c)}
                  >
                    {c === ALL ? tr('common.all') : c}
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-3">
                {shown.map((s) => {
                  const n = qtyByService.get(s.id) ?? 0
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        navigator.vibrate?.(10)
                        addItem.mutate(s)
                      }}
                      className={cn(
                        'relative flex min-h-24 min-w-0 flex-col justify-between gap-2 rounded-2xl border-2 bg-background p-3 text-left shadow-sm transition active:scale-[0.96] sm:min-h-28 sm:p-4',
                        n > 0 ? 'border-primary/60' : 'border-transparent hover:border-primary/40',
                      )}
                    >
                      {n > 0 && (
                        <span className="absolute right-2 top-2 grid min-w-6 place-items-center rounded-full bg-primary px-1.5 text-sm font-bold text-primary-foreground">
                          {n}
                        </span>
                      )}
                      <span className={cn('text-base font-semibold leading-snug sm:text-lg', n > 0 && 'pr-7')}>{s.name}</span>
                      <span className="text-lg font-bold text-primary sm:text-xl">{formatMoney(s.price)}</span>
                    </button>
                  )
                })}
                {shown.length === 0 && (
                  <p className="col-span-full text-lg text-muted-foreground">{tr('bill.noServices')}</p>
                )}
              </div>
            </>
          ) : (
            <p className="rounded-2xl border bg-background p-5 text-lg text-muted-foreground">{tr('bill.viewOnly')}</p>
          )}
        </section>

        {/* Bill: desktop column */}
        {isDesktop && (
          <aside className="h-fit space-y-4 rounded-2xl border bg-background p-5 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-xl font-bold">{tr('bill.title')}</h2>
            {renderBill(false)}
          </aside>
        )}
      </div>

      {/* Bill: phone / tablet — sticky bar opens a bottom sheet */}
      {!isDesktop && (
        <div className="pointer-events-none sticky bottom-[calc(4rem+env(safe-area-inset-bottom)+0.5rem)] z-20 mt-4 md:bottom-4">
          <Button
            size="lg"
            className="pointer-events-auto h-14 w-full justify-between gap-3 text-base shadow-lg"
            onClick={() => setBillOpen(true)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <ShoppingBag />
              <span className="truncate">
                {tr('bill.viewBill')} ({itemCount})
              </span>
            </span>
            <span className="shrink-0 text-lg font-bold">{formatMoney(total)}</span>
          </Button>
        </div>
      )}

      <Dialog open={billOpen && !isDesktop} onOpenChange={setBillOpen}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="top-auto bottom-0 left-0 max-h-[92dvh] max-w-none translate-x-0 translate-y-0 gap-3 rounded-b-none rounded-t-3xl p-4 sm:max-w-none md:left-1/2 md:max-w-xl md:-translate-x-1/2"
        >
          <DialogHeader>
            <DialogTitle className="pr-10 text-xl">
              {tr('bill.title')} · {tableName}
            </DialogTitle>
            <DialogDescription className="sr-only">{tr('bill.title')}</DialogDescription>
          </DialogHeader>
          {renderBill(true)}
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('bill.payTitle')}</DialogTitle>
            <DialogDescription className="sr-only">{tr('bill.amountDue')} {formatMoney(total)}</DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl bg-primary/10 px-4 py-4 text-center">
            <div className="text-sm font-medium text-muted-foreground">{tr('bill.amountDue')}</div>
            <div className="text-4xl font-extrabold tracking-tight text-primary">{formatMoney(total)}</div>
          </div>

          <div className="grid gap-3">
            {(['cash', 'transfer', 'card'] as PaymentMethod[]).map((m) => {
              const Icon = methodIcon[m]
              return (
                <button
                  key={m}
                  disabled={pay.isPending}
                  onClick={() => pay.mutate(m)}
                  className="flex h-[4.5rem] items-center gap-4 rounded-2xl border-2 bg-background px-4 text-left transition hover:border-primary hover:bg-primary/5 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className={cn('grid size-12 shrink-0 place-items-center rounded-full', methodTint[m])}>
                    <Icon className="size-6" />
                  </span>
                  <span className="flex-1 text-xl font-semibold">{tr(`method.${m}`)}</span>
                  <ChevronRight className="size-6 text-muted-foreground" />
                </button>
              )
            })}
          </div>

          <DialogFooter>
            <Button variant="ghost" size="lg" className="w-full" onClick={() => setPayOpen(false)}>
              {tr('common.back')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={tr('bill.cancelTitle')}
        description={tr('bill.cancelText')}
        confirmLabel={tr('bill.cancelBill')}
        cancelLabel={tr('bill.keepBill')}
        destructive
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
      />
    </>
  )
}

export default function TicketPage() {
  const { t: tr } = useTranslation()
  const { tableId } = useParams()
  const tickets = useOpenTickets()
  const tables = useTables()

  if (tickets.isLoading || tables.isLoading) return <Loading />
  const ticket = tickets.data?.find((t) => t.table_id === tableId)
  if (!ticket) return <Navigate to="/" replace />
  const table = tables.data?.find((t) => t.id === tableId)

  // Technicians who are already working on ANOTHER open bill → technician id → that table's name
  const busyAt = new Map<string, string>()
  tickets.data
    ?.filter((t) => t.id !== ticket.id)
    .forEach((t) => {
      const name = tables.data?.find((x) => x.id === t.table_id)?.name ?? tr('bill.tableFallback')
      t.ticket_items.forEach((i) => i.technician_id && busyAt.set(i.technician_id, name))
    })

  return <TicketView key={ticket.id} ticket={ticket} tableName={table?.name ?? tr('bill.tableFallback')} busyAt={busyAt} />
}
