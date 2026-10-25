import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-base text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
    </div>
  )
}

export function Loading({ text }: { text?: string }) {
  const { t } = useTranslation()
  return <div className="py-16 text-center text-lg text-muted-foreground">{text ?? t('common.loading')}</div>
}
