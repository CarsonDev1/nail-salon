export const env = {
  clerkKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined,
}

export const configMissing = !env.clerkKey || !env.supabaseUrl || !env.supabasePublishableKey

/**
 * The salon's time zone (IANA name). Every date and time in the app — "today", daily totals,
 * bill times — is shown in this zone, whatever time zone the device itself is set to.
 * Change it with VITE_SALON_TIMEZONE, e.g. America/New_York, America/Chicago, America/Denver.
 */
const DEFAULT_TIME_ZONE = 'America/Los_Angeles'
const configured = import.meta.env.VITE_SALON_TIMEZONE as string | undefined

function isValidTimeZone(zone: string | undefined): zone is string {
  if (!zone) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

export const salonTimeZone = isValidTimeZone(configured) ? configured : DEFAULT_TIME_ZONE
