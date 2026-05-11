import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Pencil, Mail, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { usePracticeId } from '@/lib/practice'
import { fetchReferrers, qk, type Referrer } from '@/lib/queries'
import { supabase } from '@/lib/supabase'

type ReferrerForm = {
  name: string
  role: string
  email: string
  phone: string
  notes: string
}

const EMPTY_FORM: ReferrerForm = { name: '', role: '', email: '', phone: '', notes: '' }

function referrerToForm(r: Referrer): ReferrerForm {
  return {
    name: r.name,
    role: r.role ?? '',
    email: r.email ?? '',
    phone: r.phone ?? '',
    notes: r.notes ?? '',
  }
}

function toNullable(s: string): string | null {
  return s.trim() === '' ? null : s.trim()
}

export function ReferrersPage() {
  const { data: practiceId } = usePracticeId()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editingReferrer, setEditingReferrer] = useState<Referrer | null>(null)

  const { data: referrers = [], isLoading } = useQuery({
    queryKey: qk.referrers(practiceId ?? ''),
    enabled: !!practiceId,
    queryFn: () => fetchReferrers(practiceId!),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ReferrerForm>({
    defaultValues: EMPTY_FORM,
  })

  const saveMutation = useMutation({
    mutationFn: async ({ values, id }: { values: ReferrerForm; id?: string }) => {
      const payload = {
        name: values.name,
        role: toNullable(values.role),
        email: toNullable(values.email),
        phone: toNullable(values.phone),
        notes: toNullable(values.notes),
      }
      if (id) {
        const { error } = await supabase.from('referrers').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('referrers').insert({ ...payload, practice_id: practiceId! })
        if (error) throw error
      }
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: qk.referrers(practiceId!) })
      toast.success(id ? 'Referrer updated' : 'Referrer added')
      setDialogOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('referrers').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.referrers(practiceId!) })
      queryClient.invalidateQueries({ queryKey: ['patient-referrers'] })
      toast.success('Referrer deleted')
      setDeleteId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openAdd() {
    setEditingReferrer(null)
    reset(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(r: Referrer) {
    setEditingReferrer(r)
    reset(referrerToForm(r))
    setDialogOpen(true)
  }

  return (
    <div className="flex-1 p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Referrers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">GPs, educators, OTs and other referring practitioners</p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-1" /> Add Referrer
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : referrers.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">No referrers yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Add referring practitioners to link them to patients and generate referral reports.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden max-w-3xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Role</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Contact</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {referrers.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{r.role ?? '—'}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-col gap-0.5">
                      {r.email && (
                        <a href={`mailto:${r.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          <Mail className="w-3 h-3" /> {r.email}
                        </a>
                      )}
                      {r.phone && (
                        <a href={`tel:${r.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          <Phone className="w-3 h-3" /> {r.phone}
                        </a>
                      )}
                      {!r.email && !r.phone && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(r.id)}
                      >
                        <span className="text-sm">×</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingReferrer ? 'Edit Referrer' : 'Add Referrer'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((values) => saveMutation.mutate({ values, id: editingReferrer?.id }))} className="space-y-4">
            <Field label="Name *">
              <Input {...register('name', { required: true })} className={errors.name ? 'border-destructive' : ''} placeholder="Dr Jane Smith" />
            </Field>
            <Field label="Role">
              <Input {...register('role')} placeholder="GP, Optometrist, OT, Teacher…" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email">
                <Input type="email" {...register('email')} />
              </Field>
              <Field label="Phone">
                <Input {...register('phone')} />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea rows={2} {...register('notes')} placeholder="Clinic address, referral preferences…" />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {editingReferrer ? 'Save Changes' : 'Add Referrer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete referrer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the referrer and unlink them from all patients. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  )
}
