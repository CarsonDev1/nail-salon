import { useState } from 'react'
import { useClerk, useUser } from '@clerk/clerk-react'
import { useQueryClient } from '@tanstack/react-query'
import { LogOut, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useProfile } from '@/lib/profile'
import { cn } from '@/lib/utils'

/** Signs out and forgets everything cached for this user, so the next account starts clean. */
export function useSignOut() {
  const { signOut } = useClerk()
  const qc = useQueryClient()
  return async () => {
    await signOut()
    qc.clear()
  }
}

export function UserAvatar({ className }: { className?: string }) {
  const { user } = useUser()
  const label = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? '?'
  return user?.imageUrl ? (
    <img src={user.imageUrl} alt="" className={cn('size-10 shrink-0 rounded-full object-cover', className)} />
  ) : (
    <div className={cn('grid size-10 shrink-0 place-items-center rounded-full bg-primary font-bold text-primary-foreground', className)}>
      {label.charAt(0).toUpperCase()}
    </div>
  )
}

/** Avatar + name + role (+ email). */
export function AccountSummary({ showEmail }: { showEmail?: boolean }) {
  const { t } = useTranslation()
  const { user } = useUser()
  const { profile } = useProfile()
  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar />
      <div className="min-w-0 leading-tight">
        <div className="truncate font-semibold">{profile?.full_name ?? user?.fullName}</div>
        <div className="text-sm text-muted-foreground">{profile ? t(`role.${profile.role}`) : ''}</div>
        {showEmail && <div className="truncate text-sm text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</div>}
      </div>
    </div>
  )
}

/** Big, obvious sign-out button. */
export function SignOutButton({ className, variant = 'outline' }: { className?: string; variant?: 'outline' | 'destructive' }) {
  const { t } = useTranslation()
  const signOut = useSignOut()
  return (
    <Button variant={variant} className={className} onClick={() => void signOut()}>
      <LogOut /> {t('common.signOut')}
    </Button>
  )
}

/** Phone top bar: tap the avatar to see the account and sign out. */
export function AccountButton() {
  const { t } = useTranslation()
  const { openUserProfile } = useClerk()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={t('account.title')} className="rounded-full">
        <UserAvatar />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">{t('account.title')}</DialogTitle>
            <DialogDescription className="sr-only">{t('account.title')}</DialogDescription>
          </DialogHeader>
          <AccountSummary showEmail />
          <div className="grid gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false)
                openUserProfile()
              }}
            >
              <Settings /> {t('account.manage')}
            </Button>
            <SignOutButton variant="destructive" />
          </div>
          <p className="text-sm text-muted-foreground">{t('account.switchHint')}</p>
        </DialogContent>
      </Dialog>
    </>
  )
}
