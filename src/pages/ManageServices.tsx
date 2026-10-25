import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { MoneyInput } from '@/components/MoneyInput'
import { Loading, PageHeader } from '@/components/PageHeader'
import { formatMoney } from '@/lib/format'
import { useServices } from '@/lib/queries'
import { useSb } from '@/lib/supabase'
import type { Service } from '@/lib/types'

type Draft = { id?: string; name: string; category: string; price: number; duration_min: number }
const empty: Draft = { name: '', category: '', price: 0, duration_min: 30 }

export default function ManageServices() {
  const { t: tr } = useTranslation()
  const sb = useSb()
  const qc = useQueryClient()
  const services = useServices()
  const [draft, setDraft] = useState<Draft | null>(null)

  const refresh = () => qc.invalidateQueries({ queryKey: ['services'] })

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const row = { name: d.name.trim(), category: d.category.trim() || tr('common.other'), price: d.price, duration_min: d.duration_min || 30 }
      const { error } = d.id ? await sb.from('services').update(row).eq('id', d.id) : await sb.from('services').insert(row)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(tr('services.saved'))
      setDraft(null)
      return refresh()
    },
  })

  const toggle = useMutation({
    mutationFn: async (s: Service) => {
      const { error } = await sb.from('services').update({ active: !s.active }).eq('id', s.id)
      if (error) throw error
    },
    onSuccess: refresh,
  })

  if (services.isLoading) return <Loading />
  const list = services.data ?? []
  const categories = Array.from(new Set(list.map((s) => s.category)))
  const valid = !!draft && draft.name.trim().length > 0

  return (
    <>
      <PageHeader
        title={tr('services.title')}
        subtitle={tr('services.subtitle')}
        actions={
          <Button size="lg" onClick={() => setDraft(empty)}>
            <Plus /> {tr('services.add')}
          </Button>
        }
      />

      <div className="space-y-6">
        {categories.map((cat) => (
          <section key={cat}>
            <h2 className="mb-2 text-xl font-bold">{cat}</h2>
            <div className="divide-y rounded-2xl border bg-background">
              {list
                .filter((s) => s.category === cat)
                .map((s) => (
                  <div key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 p-4 sm:flex sm:flex-wrap sm:gap-4">
                    <div className={`min-w-0 sm:flex-1 ${s.active ? '' : 'opacity-50'}`}>
                      <div className="text-lg font-semibold leading-snug">{s.name}</div>
                      <div className="text-sm text-muted-foreground">{tr('common.min', { count: s.duration_min })}</div>
                    </div>
                    <div className="text-right text-lg font-bold text-primary">{formatMoney(s.price)}</div>
                    <label className="flex items-center gap-2 text-base">
                      <Switch checked={s.active} onCheckedChange={() => toggle.mutate(s)} />
                      {s.active ? tr('services.onSale') : tr('services.hidden')}
                    </label>
                    <Button variant="outline" className="justify-self-end" onClick={() => setDraft({ ...s })}>
                      <Pencil /> {tr('common.edit')}
                    </Button>
                  </div>
                ))}
            </div>
          </section>
        ))}
        {list.length === 0 && <p className="text-lg text-muted-foreground">{tr('services.none')}</p>}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl">{draft?.id ? tr('services.editTitle') : tr('services.add')}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sn" className="text-base">{tr('services.name')}</Label>
                <Input id="sn" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sc" className="text-base">{tr('services.category')}</Label>
                <Input id="sc" list="cats" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
                <datalist id="cats">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sp" className="text-base">{tr('services.price')}</Label>
                  <MoneyInput id="sp" value={draft.price} onChange={(n) => setDraft({ ...draft, price: n })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sd" className="text-base">{tr('services.duration')}</Label>
                  <Input
                    id="sd"
                    inputMode="numeric"
                    value={draft.duration_min || ''}
                    onChange={(e) => setDraft({ ...draft, duration_min: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="lg" onClick={() => setDraft(null)}>{tr('common.cancel')}</Button>
            <Button size="lg" disabled={!valid || save.isPending} onClick={() => draft && save.mutate(draft)}>{tr('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
