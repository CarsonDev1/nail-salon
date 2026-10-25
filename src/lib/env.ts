export const env = {
  clerkKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined,
}

export const configMissing = !env.clerkKey || !env.supabaseUrl || !env.supabasePublishableKey
