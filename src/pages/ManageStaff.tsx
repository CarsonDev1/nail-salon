import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loading, PageHeader } from '@/components/PageHeader'
import { useProfile } from '@/lib/profile'
import { useStaff } from '@/lib/queries'
import { useSb } from '@/lib/supabase'
import type { Profile, Role } from '@/lib/types'

const OWNER_EMAIL = 'buitritinht@gmail.com'
const roles: Role[] = ['admin', 'receptionist', 'technician', 'pending']
const assignable: Role[] = ['technician', 'receptionist', 'admin']

interface Draft {
  id?: string
  full_name: string
  email: string
  role: Role
}
const empty: Draft = { full_name: '', email: '', role: 'technician' }

export default function ManageStaff() {
  const { t: tr } = useTranslation()
  const sb = useSb()
  const qc = useQueryClient()
  const me = useProfile().profile
  const staff = useStaff()
  const [draft, setDraft] = useState<Draft | null>(null)

  const refresh = () => qc.invalidateQueries({ queryKey: ['staff'] })

  const update = useMutation({
    mutationFn: async (v: { id: string; patch: Partial<Pick<Profile, 'role' | 'active'>> }) => {
      const { error } = await sb.from('profiles').update(v.patch).eq('id', v.id)
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const row = { full_name: d.full_name.trim(), email: d.email.trim().toLowerCase() || null, role: d.role }
      const { error } = d.id
        ? await sb.from('profiles').update({ full_name: row.full_name, email: row.email }).eq('id', d.id)
        : await sb.from('profiles').insert({ ...row, active: true })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(tr('staff.saved'))
      setDraft(null)
      return refresh()
    },
  })

  if (staff.isLoading) return <Loading />
  const list = [...(staff.data ?? [])].sort((a, b) => Number(b.role === 'pending') - Number(a.role === 'pending'))
  const waiting = list.filter((p) => p.role === 'pending').length

  return (
    <>
      <PageHeader
        title={tr('staff.title')}
        subtitle={waiting > 0 ? tr('staff.subtitleWaiting', { count: waiting }) : tr('staff.subtitle')}
        actions={
          <Button size="lg" onClick={() => setDraft(empty)}>
            <Plus /> {tr('staff.add')}
          </Button>
        }
      />
      <div className="mb-4 space-y-1.5 rounded-2xl border bg-background p-4 text-base text-muted-foreground">
        <p><b className="text-foreground">{tr('role.receptionist')}</b>: {tr('staff.legendReceptionist')}</p>
        <p><b className="text-foreground">{tr('role.technician')}</b>: {tr('staff.legendTechnician')}</p>
        <p><b className="text-foreground">{tr('role.admin')}</b>: {tr('staff.legendOwner')}</p>
      </div>
      <div className="divide-y rounded-2xl border bg-background">
        {list.map((p) => {
          const isOwner = p.email?.toLowerCase() === OWNER_EMAIL
          const isMe = p.id === me?.id
          return (
            <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 p-4 sm:flex sm:flex-wrap sm:gap-4">
              <div className={`min-w-0 sm:min-w-44 sm:flex-1 ${p.active ? '' : 'opacity-50'}`}>
                <div className="flex flex-wrap items-center gap-x-2 text-lg font-semibold">
                  <span className="truncate">{p.full_name}</span>
                  {isMe && <Badge variant="secondary">{tr('staff.you')}</Badge>}
                  {p.role === 'pending' && <Badge>{tr('staff.pending')}</Badge>}
                  {!p.clerk_user_id && <Badge variant="outline">{tr('staff.noLogin')}</Badge>}
                </div>
                <div className="truncate text-sm text-muted-foreground">{p.email}</div>
              </div>
              <label className="flex items-center gap-2 text-base sm:order-3">
                <Switch
                  checked={p.active}
                  disabled={isOwner || isMe}
                  onCheckedChange={(v) => update.mutate({ id: p.id, patch: { active: v } })}
                />
                <span className="hidden min-[400px]:inline">{p.active ? tr('staff.active') : tr('staff.locked')}</span>
              </label>
              <Select
                value={p.role}
                disabled={isOwner || isMe}
                onValueChange={(v) => update.mutate({ id: p.id, patch: { role: v as Role } })}
              >
                <SelectTrigger className="w-full sm:order-2 sm:w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {tr(`role.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="icon"
                variant="outline"
                aria-label={tr('common.edit')}
                className="justify-self-end sm:order-1"
                onClick={() => setDraft({ id: p.id, full_name: p.full_name ?? '', email: p.email ?? '', role: p.role })}
              >
                <Pencil />
              </Button>
            </div>
          )
        })}
        {list.length === 0 && <div className="p-6 text-lg text-muted-foreground">—</div>}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-2xl">{draft?.id ? tr('staff.editTitle') : tr('staff.addTitle')}</DialogTitle>
            <DialogDescription className="sr-only">{tr('staff.title')}</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sf-name" className="text-base">{tr('staff.name')}</Label>
                <Input id="sf-name" value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} autoFocus />
              </div>
              {!draft.id && (
                <div className="space-y-2">
                  <Label className="text-base">{tr('staff.role')}</Label>
                  <Select value={draft.role} onValueChange={(v) => setDraft({ ...draft, role: v as Role })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assignable.map((r) => (
                        <SelectItem key={r} value={r}>
                          {tr(`role.${r}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="sf-email" className="text-base">{tr('staff.email')}</Label>
                <Input
                  id="sf-email"
                  type="email"
                  inputMode="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="lg" onClick={() => setDraft(null)}>{tr('common.cancel')}</Button>
            <Button size="lg" disabled={!draft?.full_name.trim() || save.isPending} onClick={() => draft && save.mutate(draft)}>
              {tr('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
