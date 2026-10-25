import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AccountButton, AccountSummary, SignOutButton } from '@/components/Account'
import { BarChart3, LayoutGrid, Receipt, Scissors, Table2, Users, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { SalonClock } from '@/components/SalonClock'
import { usePermissions } from '@/lib/profile'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  key: string
  icon: LucideIcon
  show: (p: { isAdmin: boolean; canCashier: boolean }) => boolean
}

const items: NavItem[] = [
  { to: '/', key: 'floorPlan', icon: LayoutGrid, show: () => true },
  { to: '/bills', key: 'bills', icon: Receipt, show: (p) => p.canCashier },
  { to: '/overview', key: 'overview', icon: BarChart3, show: (p) => p.canCashier },
  { to: '/services', key: 'services', icon: Scissors, show: (p) => p.isAdmin },
  { to: '/tables', key: 'manageTables', icon: Table2, show: (p) => p.isAdmin },
  { to: '/staff', key: 'staff', icon: Users, show: (p) => p.isAdmin },
]

export function Layout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  // Every page starts at the top (phones keep the old scroll position otherwise)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  const perms = usePermissions()
  const nav = items.filter((i) => i.show(perms))

  return (
    <div className="min-h-dvh bg-secondary/40 md:pl-64">
      {/* Sidebar (tablet landscape / desktop) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r bg-sidebar p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2 pt-2 text-2xl font-bold text-primary">
          <span aria-hidden>💅</span> {t('app.name')}
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map(({ to, key, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-4 py-3.5 text-lg font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent',
                )
              }
            >
              <Icon className="size-6" />
              {t(`nav.${key}`)}
            </NavLink>
          ))}
        </nav>
        <SalonClock className="mb-3 px-1" />
        <LanguageSwitcher className="mb-3 self-start" />
        <div className="space-y-3 rounded-xl border bg-background p-3">
          <AccountSummary />
          <SignOutButton className="w-full" />
        </div>
      </aside>

      {/* Top bar (phone / small tablet) */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b bg-background/95 px-4 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] backdrop-blur md:hidden">
        <div className="flex min-w-0 items-center gap-2 text-xl font-bold text-primary">
          <span aria-hidden>💅</span>
          <span className="truncate">{t('app.name')}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <LanguageSwitcher compact />
          <AccountButton />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-5 md:p-8 md:pb-8">
        <Outlet />
      </main>

      {/* Bottom tab bar (phone / small tablet) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {nav.map(({ to, key, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'relative flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0 text-[0.66rem] font-medium leading-tight tracking-tight transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute inset-x-4 top-0 h-1 rounded-b-full bg-primary" />}
                <Icon className="size-6" />
                <span className="w-full truncate text-center">{t(`nav.short.${key}`)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
