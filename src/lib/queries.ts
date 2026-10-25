import { useQuery } from '@tanstack/react-query'
import { useSb } from './supabase'
import type { Profile, SalonTable, Service, Ticket } from './types'

export const POLL_MS = 5000

export function useTables() {
  const sb = useSb()
  return useQuery({
    queryKey: ['tables'],
    queryFn: async () => {
      const { data, error } = await sb.from('salon_tables').select('*').order('sort_order').order('name')
      if (error) throw error
      return data as SalonTable[]
    },
  })
}

export function useServices() {
  const sb = useSb()
  return useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await sb.from('services').select('*').order('category').order('name')
      if (error) throw error
      return data as Service[]
    },
  })
}

export function useStaff() {
  const sb = useSb()
  return useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data, error } = await sb.from('profiles').select('*').order('created_at')
      if (error) throw error
      return data as Profile[]
    },
  })
}

/** Open tickets — auto-refreshed so several devices stay in sync. */
export function useOpenTickets() {
  const sb = useSb()
  return useQuery({
    queryKey: ['open-tickets'],
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data, error } = await sb.from('tickets').select('*, ticket_items(*)').eq('status', 'open')
      if (error) throw error
      return data as Ticket[]
    },
  })
}
