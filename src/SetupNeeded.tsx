import { Trans, useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export function SetupNeeded() {
  const { t } = useTranslation()
  return (
    <div className="grid min-h-screen place-items-center bg-secondary/40 p-6">
      <div className="max-w-xl rounded-2xl border bg-background p-8 shadow-sm">
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
        <h1 className="mb-3 text-2xl font-bold">{t('setup.title')}</h1>
        <p className="mb-4 text-base text-muted-foreground">
          <Trans i18nKey="setup.intro" components={{ code: <code /> }} />
        </p>
        <pre className="rounded-lg bg-muted p-4 text-sm">
{`VITE_CLERK_PUBLISHABLE_KEY=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...`}
        </pre>
        <p className="mt-4 text-sm text-muted-foreground">{t('setup.readme')}</p>
      </div>
    </div>
  )
}
