import { createContext, useContext, type ReactNode } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useSb } from './supabase'
import type { Profile } from './types'

interface ProfileState {
  profile: Profile | null
  isLoading: boolean
  error: unknown
  refetch: () => void
}

const ProfileContext = createContext<ProfileState | null>(null)

/** Calls ensure_profile on first sign-in: the DB makes the owner's email an admin. */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const sb = useSb()
  const { user } = useUser()

  const q = useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await sb.rpc('ensure_profile', { p_full_name: user?.fullName ?? null })
      if (error) throw error
      return data as Profile
    },
  })

  return (
    <ProfileContext.Provider
      value={{ profile: q.data ?? null, isLoading: q.isLoading, error: q.error, refetch: () => void q.refetch() }}
    >
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const c = useContext(ProfileContext)
  if (!c) throw new Error('useProfile must be used inside ProfileProvider')
  return c
}

/** Role-based permissions — shared by the menu, buttons and routes. */
export function usePermissions() {
  const role = useProfile().profile?.role
  return {
    role,
    isAdmin: role === 'admin',
    canCashier: role === 'admin' || role === 'receptionist',
  }
}
