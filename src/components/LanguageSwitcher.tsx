import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '@/i18n'
import { cn } from '@/lib/utils'

const labels: Record<string, string> = { en: 'EN', vi: 'VI' }

/** Two toggle buttons: EN | VI. `compact` is the smaller version for the phone top bar. */
export function LanguageSwitcher({ className, compact }: { className?: string; compact?: boolean }) {
  const { i18n, t } = useTranslation()
  const current = i18n.language.startsWith('vi') ? 'vi' : 'en'

  return (
    <div role="group" aria-label={t('common.language')} className={cn('inline-flex rounded-xl border bg-background p-1', className)}>
      {LANGUAGES.map((lng) => (
        <button
          key={lng}
          onClick={() => void i18n.changeLanguage(lng)}
          aria-pressed={current === lng}
          className={cn(
            'rounded-lg font-semibold transition-colors',
            compact ? 'px-3 py-1 text-sm' : 'px-4 py-1.5 text-base',
            current === lng ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {labels[lng]}
        </button>
      ))}
    </div>
  )
}
