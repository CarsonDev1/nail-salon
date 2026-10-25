import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { formatTime, timeZoneAbbr } from '@/lib/format'
import { salonTimeZone } from '@/lib/env'
import { cn } from '@/lib/utils'

/** Current time in the salon's time zone, e.g. "2:35 PM PDT". */
export function SalonClock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)} title={salonTimeZone}>
      <Clock className="size-4" />
      <span>
        {formatTime(now)} {timeZoneAbbr()}
      </span>
    </div>
  )
}
