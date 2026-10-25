import type { ReactElement } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { SignedIn, SignedOut, SignIn, SignUp, useUser } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import { SignOutButton } from '@/components/Account'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { Layout } from '@/components/Layout'
import { Loading } from '@/components/PageHeader'
import { friendlyError } from '@/lib/supabase'
import { ProfileProvider, usePermissions, useProfile } from '@/lib/profile'
import Dashboard from '@/pages/Dashboard'
import History from '@/pages/History'
import ManageServices from '@/pages/ManageServices'
import ManageStaff from '@/pages/ManageStaff'
import ManageTables from '@/pages/ManageTables'
import TablesPage from '@/pages/TablesPage'
import TicketPage from '@/pages/TicketPage'

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-secondary/40 p-6">{children}</div>
}

function Blocked({ title, text }: { title: string; text: string }) {
  const { user } = useUser()
  const { t } = useTranslation()
  return (
    <Centered>
      <div className="max-w-md rounded-2xl border bg-background p-8 text-center shadow-sm">
        <div className="mb-3 text-5xl">💅</div>
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-1 text-base text-muted-foreground">{text}</p>
        <p className="mb-6 text-sm text-muted-foreground">
          {t('auth.account', { email: user?.primaryEmailAddress?.emailAddress })}
        </p>
        <div className="flex flex-col items-center gap-4">
          <SignOutButton />
          <p className="text-sm text-muted-foreground">{t('account.switchHint')}</p>
          <LanguageSwitcher />
        </div>
      </div>
    </Centered>
  )
}

/** Only lets people in with the right role, otherwise goes home. */
function Guard({ allow, children }: { allow: 'cashier' | 'admin'; children: ReactElement }) {
  const { isAdmin, canCashier } = usePermissions()
  const ok = allow === 'admin' ? isAdmin : canCashier
  return ok ? children : <Navigate to="/" replace />
}

function Gate() {
  const { t } = useTranslation()
  const { profile, isLoading, error, refetch } = useProfile()

  if (isLoading) return <Centered><Loading text={t('auth.signingIn')} /></Centered>
  if (error || !profile) {
    return (
      <Centered>
        <div className="max-w-md rounded-2xl border bg-background p-8 text-center shadow-sm">
          <h1 className="mb-2 text-2xl font-bold">{t('auth.cantConnect')}</h1>
          <p className="mb-6 text-base text-muted-foreground">{friendlyError(error)}</p>
          <div className="flex flex-col items-center gap-3">
            <Button size="lg" onClick={refetch}>
              {t('common.tryAgain')}
            </Button>
            <SignOutButton />
          </div>
        </div>
      </Centered>
    )
  }
  if (!profile.active) {
    return <Blocked title={t('auth.suspendedTitle')} text={t('auth.suspendedText')} />
  }
  if (profile.role === 'pending') {
    return <Blocked title={t('auth.pendingTitle')} text={t('auth.pendingText')} />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<TablesPage />} />
        <Route path="table/:tableId" element={<TicketPage />} />
        <Route path="bills" element={<Guard allow="cashier"><History /></Guard>} />
        <Route path="overview" element={<Guard allow="cashier"><Dashboard /></Guard>} />
        <Route path="services" element={<Guard allow="admin"><ManageServices /></Guard>} />
        <Route path="tables" element={<Guard allow="admin"><ManageTables /></Guard>} />
        <Route path="staff" element={<Guard allow="admin"><ManageStaff /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  return (
    <>
      <SignedOut>
        <Centered>
          <div className="flex flex-col items-center gap-4">
            <LanguageSwitcher />
            <div className="text-3xl font-bold text-primary">💅 {t('app.name')}</div>
            {/* Sign-in and sign-up both live inside this app, so Clerk never sends people to its hosted pages */}
            {pathname.startsWith('/sign-up') ? (
              <SignUp routing="hash" signInUrl="/" fallbackRedirectUrl="/" />
            ) : (
              <SignIn routing="hash" signUpUrl="/sign-up" fallbackRedirectUrl="/" />
            )}
          </div>
        </Centered>
      </SignedOut>
      <SignedIn>
        <ProfileProvider>
          <Gate />
        </ProfileProvider>
      </SignedIn>
    </>
  )
}
