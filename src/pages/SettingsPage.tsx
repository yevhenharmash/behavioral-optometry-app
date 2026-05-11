import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { usePracticeId } from '@/lib/practice'
import { fetchPractice, qk, type Practice } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type PracticeForm = {
  name: string
  address: string
  phone: string
  email: string
}

type ProfileForm = {
  full_name: string
}

function toNullable(s: string): string | null {
  return s.trim() === '' ? null : s.trim()
}

function practiceToForm(p: Practice): PracticeForm {
  return {
    name: p.name,
    address: p.address ?? '',
    phone: p.phone ?? '',
    email: p.email ?? '',
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  )
}

function PracticeSection({ practiceId }: { practiceId: string }) {
  const queryClient = useQueryClient()

  const { data: practice, isLoading } = useQuery({
    queryKey: qk.practice(practiceId),
    queryFn: () => fetchPractice(practiceId),
  })

  const { register, handleSubmit, reset } = useForm<PracticeForm>({
    values: practice ? practiceToForm(practice) : undefined,
  })

  const saveMutation = useMutation({
    mutationFn: async (values: PracticeForm) => {
      const { error } = await supabase
        .from('practices')
        .update({
          name: values.name,
          address: toNullable(values.address),
          phone: toNullable(values.phone),
          email: toNullable(values.email),
        })
        .eq('id', practiceId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.practice(practiceId) })
      toast.success('Practice info saved')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4 max-w-md">
      <Field label="Practice Name *">
        <Input {...register('name', { required: true })} />
      </Field>
      <Field label="Address">
        <Input {...register('address')} placeholder="123 Main Street, City, State" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Phone">
          <Input {...register('phone')} />
        </Field>
        <Field label="Email">
          <Input type="email" {...register('email')} />
        </Field>
      </div>
      <div className="flex gap-3">
        <Button type="submit" size="sm" disabled={saveMutation.isPending}>Save Changes</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => practice && reset(practiceToForm(practice))}>
          Discard
        </Button>
      </div>
    </form>
  )
}

function ProfileSection() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { register, handleSubmit } = useForm<ProfileForm>({
    values: { full_name: user?.user_metadata?.full_name ?? '' },
  })

  const saveMutation = useMutation({
    mutationFn: async (values: ProfileForm) => {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: values.full_name.trim() || null },
      })
      if (error) throw error
      await supabase
        .from('profiles')
        .update({ full_name: toNullable(values.full_name) })
        .eq('id', user!.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success('Profile saved')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4 max-w-md">
      <Field label="Display Name">
        <Input {...register('full_name')} placeholder="Dr Jane Smith" />
      </Field>
      <Field label="Email">
        <Input value={user?.email ?? ''} disabled className="bg-muted/50 cursor-not-allowed" />
      </Field>
      <Button type="submit" size="sm" disabled={saveMutation.isPending}>Save Profile</Button>
    </form>
  )
}

function ArchivedPatientsSection({ practiceId }: { practiceId: string }) {
  const queryClient = useQueryClient()

  const { data: archived = [], isLoading } = useQuery({
    queryKey: ['archived-patients', practiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('id, first_name, last_name, updated_at')
        .eq('practice_id', practiceId)
        .eq('is_archived', true)
        .order('last_name')
      if (error) throw error
      return data
    },
  })

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('patients').update({ is_archived: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archived-patients', practiceId] })
      queryClient.invalidateQueries({ queryKey: ['patients', practiceId] })
      toast.success('Patient restored')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>

  if (archived.length === 0) {
    return <p className="text-sm text-muted-foreground">No archived patients.</p>
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden max-w-md">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {archived.map((p) => (
            <tr key={p.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5">{p.last_name}, {p.first_name}</td>
              <td className="px-4 py-2.5 text-right">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => restoreMutation.mutate(p.id)}
                >
                  Restore
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SettingsPage() {
  const { data: practiceId } = usePracticeId()

  return (
    <div className="flex-1 p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold text-foreground mb-8">Settings</h1>

      <section className="mb-10">
        <SectionTitle title="Practice Info" subtitle="Name and contact details shown on reports." />
        {practiceId && <PracticeSection practiceId={practiceId} />}
      </section>

      <Separator className="mb-10" />

      <section className="mb-10">
        <SectionTitle title="Your Profile" subtitle="Display name used in the app." />
        <ProfileSection />
      </section>

      <Separator className="mb-10" />

      <section>
        <SectionTitle title="Archived Patients" subtitle="Restore patients that were previously archived." />
        {practiceId && <ArchivedPatientsSection practiceId={practiceId} />}
      </section>
    </div>
  )
}
