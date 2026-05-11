import { useAuth } from '@/lib/auth'

export function TodayPage() {
  const { user } = useAuth()
  const name = user?.user_metadata?.full_name ?? user?.email ?? 'Doctor'

  return (
    <div className="flex-1 p-8">
      <h1 className="text-2xl font-semibold text-foreground mb-1">
        Good morning, {name.split(' ')[0]}
      </h1>
      <p className="text-sm text-muted-foreground">
        {new Date().toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
        <StatCard label="Today's appointments" value="—" />
        <StatCard label="Active VT programs" value="—" />
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
