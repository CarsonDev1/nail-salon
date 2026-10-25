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
import { Loading, PageHeader } from '@/components/PageHeader'
import { useTables } from '@/lib/queries'
import { useSb } from '@/lib/supabase'
import type { SalonTable } from '@/lib/types'

export default function ManageTables() {
  const { t: tr } = useTranslation()
  const sb = useSb()
  const qc = useQueryClient()
  const tables = useTables()
  const [draft, setDraft] = useState<{ id?: string; name: string } | null>(null)

  const refresh = () => qc.invalidateQueries({ queryKey: ['tables'] })
  const list = tables.data ?? []

  const save = useMutation({
    mutationFn: async (d: { id?: string; name: string }) => {
      const name = d.name.trim()
      const { error } = d.id
        ? await sb.from('salon_tables').update({ name }).eq('id', d.id)
        : await sb.from('salon_tables').insert({ name, sort_order: Math.max(0, ...list.map((t) => t.sort_order)) + 1 })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(tr('tables.saved'))
      setDraft(null)
      return refresh()
    },
  })

  const toggle = useMutation({
    mutationFn: async (t: SalonTable) => {
      const { error } = await sb.from('salon_tables').update({ active: !t.active }).eq('id', t.id)
      if (error) throw error
    },
    onSuccess: refresh,
  })

  if (tables.isLoading) return <Loading />

  return (
    <>
      <PageHeader
        title={tr('tables.title')}
        subtitle={tr('tables.subtitle')}
        actions={
          <Button size="lg" onClick={() => setDraft({ name: tr('tables.defaultName', { n: list.length + 1 }) })}>
            <Plus /> {tr('tables.add')}
          </Button>
        }
      />
      <div className="divide-y rounded-2xl border bg-background">
        {list.map((t) => (
          <div key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 p-4 sm:flex sm:flex-wrap sm:gap-4">
            <div className={`truncate text-xl font-semibold sm:flex-1 ${t.active ? '' : 'opacity-50'}`}>{t.name}</div>
            <Button variant="outline" className="justify-self-end sm:order-3" onClick={() => setDraft({ id: t.id, name: t.name })}>
              <Pencil /> {tr('tables.rename')}
            </Button>
            <label className="col-span-2 flex items-center gap-2 text-base sm:order-2 sm:col-auto">
              <Switch checked={t.active} onCheckedChange={() => toggle.mutate(t)} />
              {t.active ? tr('tables.inUse') : tr('tables.hidden')}
            </label>
          </div>
        ))}
        {list.length === 0 && <div className="p-6 text-lg text-muted-foreground">{tr('tables.none')}</div>}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl">{draft?.id ? tr('tables.renameTitle') : tr('tables.add')}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-2">
              <Label htmlFor="tn" className="text-base">{tr('tables.name')}</Label>
              <Input id="tn" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="lg" onClick={() => setDraft(null)}>{tr('common.cancel')}</Button>
            <Button size="lg" disabled={!draft?.name.trim() || save.isPending} onClick={() => draft && save.mutate(draft)}>{tr('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
