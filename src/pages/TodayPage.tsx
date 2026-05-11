import { useQuery } from '@tanstack/react-query'
import { startOfDay, endOfDay, formatISO } from 'date-fns'
import { useAuth } from '@/lib/auth'
import { usePracticeId } from '@/lib/practice'
import { fetchTodayStats, qk } from '@/lib/queries'

export function TodayPage() {
  const { user } = useAuth()
  const { data: practiceId } = usePracticeId()
  const name = user?.user_metadata?.full_name ?? user?.email ?? 'Doctor'

  const today = new Date()
  const todayStart = formatISO(startOfDay(today))
  const todayEnd = formatISO(endOfDay(today))
  const hour = today.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const { data: stats } = useQuery({
    queryKey: qk.todayStats(practiceId ?? '', todayStart),
    enabled: !!practiceId,
    queryFn: () => fetchTodayStats(practiceId!, todayStart, todayEnd),
  })

  return (
    <div className="flex-1 p-8">
      <h1 className="text-2xl font-semibold text-foreground mb-1">
        {greeting}, {name.split(' ')[0]}
      </h1>
      <p className="text-sm text-muted-foreground">
        {today.toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
        <StatCard label="Today's appointments" value={stats ? String(stats.apptCount) : '—'} />
        <StatCard label="Active VT programs" value={stats ? String(stats.vtCount) : '—'} />
        <StatCard label="Pending intake drafts" value="—" />
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  )
}
