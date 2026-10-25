import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import { enUS, viVN } from '@clerk/localizations'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import '@/i18n'
import { configMissing, env } from '@/lib/env'
import { friendlyError, SupabaseProvider } from '@/lib/supabase'
import App from './App'
import { SetupNeeded } from './SetupNeeded'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 2000 } },
  mutationCache: new MutationCache({
    onError: (e) => toast.error(friendlyError(e)),
  }),
})

/** Clerk's sign-in screens follow the selected UI language. */
function Providers() {
  const { i18n } = useTranslation()
  return (
    <ClerkProvider
      publishableKey={env.clerkKey!}
      afterSignOutUrl="/"
      signInUrl="/"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      localization={i18n.language.startsWith('vi') ? viVN : enUS}
    >
      <QueryClientProvider client={queryClient}>
        <SupabaseProvider>
          <TooltipProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
            <Toaster position="top-center" richColors />
          </TooltipProvider>
        </SupabaseProvider>
      </QueryClientProvider>
    </ClerkProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{configMissing ? <SetupNeeded /> : <Providers />}</StrictMode>,
)
