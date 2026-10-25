import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import i18n from '@/i18n'
import { env } from './env'

const SupabaseContext = createContext<SupabaseClient | null>(null)

/** Creates a Supabase client that uses the Clerk token so Postgres (RLS) knows who is signed in. */
export function SupabaseProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth()
  const getTokenRef = useRef(getToken)
  useEffect(() => {
    getTokenRef.current = getToken
  }, [getToken])

  const client = useMemo(
    () =>
      createClient(env.supabaseUrl!, env.supabasePublishableKey!, {
        accessToken: async () => (await getTokenRef.current()) ?? null,
      }),
    [],
  )

  return <SupabaseContext.Provider value={client}>{children}</SupabaseContext.Provider>
}

export function useSb() {
  const c = useContext(SupabaseContext)
  if (!c) throw new Error('useSb must be used inside SupabaseProvider')
  return c
}

/** Known database messages (see supabase/schema.sql) → translation keys. */
const dbMessages: [RegExp, string][] = [
  [/row-level security|permission denied|do not have permission/i, 'errors.noPermission'],
  [/Failed to fetch|NetworkError/i, 'errors.network'],
  [/duplicate key/i, 'errors.duplicate'],
  [/already has a customer/i, 'errors.tableBusy'],
  [/already working at another table/i, 'errors.techBusy'],
  [/no longer open/i, 'errors.billClosed'],
  [/has no services yet/i, 'errors.billEmpty'],
  [/Invalid payment method/i, 'errors.invalidMethod'],
]

/** Turns technical errors into plain, translated messages. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : ''
  if (!msg) return i18n.t('errors.generic')
  const hit = dbMessages.find(([re]) => re.test(msg))
  return hit ? i18n.t(hit[1]) : msg
}
