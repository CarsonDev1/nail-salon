export type Role = 'admin' | 'receptionist' | 'technician' | 'pending'
export type PaymentMethod = 'cash' | 'transfer' | 'card'
export type TicketStatus = 'open' | 'paid' | 'cancelled'

export interface Profile {
  id: string
  clerk_user_id: string | null
  email: string | null
  full_name: string | null
  role: Role
  active: boolean
}

export interface Service {
  id: string
  name: string
  category: string
  price: number
  duration_min: number
  active: boolean
}

export interface SalonTable {
  id: string
  name: string
  sort_order: number
  active: boolean
}

export interface TicketItem {
  id: string
  ticket_id: string
  service_id: string | null
  name: string
  price: number
  qty: number
  technician_id: string | null
}

export interface Ticket {
  id: string
  table_id: string
  customer_name: string | null
  customer_phone: string | null
  status: TicketStatus
  discount: number
  tip: number
  total: number
  payment_method: PaymentMethod | null
  opened_at: string
  paid_at: string | null
  ticket_items: TicketItem[]
  salon_tables?: { name: string } | null
}
