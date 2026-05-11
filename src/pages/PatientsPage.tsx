import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { Plus, Search, Pencil, Archive } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { usePracticeId } from '@/lib/practice'
import { fetchPatients, qk, type Patient } from '@/lib/queries'
import { supabase } from '@/lib/supabase'

type PatientForm = {
  first_name: string
  last_name: string
  dob: string
  sex: string
  email: string
  phone: string
  guardian_name: string
  guardian_email: string
  guardian_phone: string
  school: string
  grade: string
  chief_complaint: string
  referral_source: string
  allied_health_notes: string
}

const EMPTY_FORM: PatientForm = {
  first_name: '', last_name: '', dob: '', sex: '', email: '', phone: '',
  guardian_name: '', guardian_email: '', guardian_phone: '',
  school: '', grade: '', chief_complaint: '', referral_source: '', allied_health_notes: '',
}

function patientToForm(p: Patient): PatientForm {
  return {
    first_name: p.first_name,
    last_name: p.last_name,
    dob: p.dob ?? '',
    sex: p.sex ?? '',
    email: p.email ?? '',
    phone: p.phone ?? '',
    guardian_name: p.guardian_name ?? '',
    guardian_email: p.guardian_email ?? '',
    guardian_phone: p.guardian_phone ?? '',
    school: p.school ?? '',
    grade: p.grade ?? '',
    chief_complaint: p.chief_complaint ?? '',
    referral_source: p.referral_source ?? '',
    allied_health_notes: p.allied_health_notes ?? '',
  }
}

function toNullable(s: string): string | null {
  return s.trim() === '' ? null : s.trim()
}

export function PatientsPage() {
  const navigate = useNavigate()
  const { data: practiceId } = usePracticeId()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [archiveId, setArchiveId] = useState<string | null>(null)
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null)

  const { data: patients = [], isLoading } = useQuery({
    queryKey: qk.patients(practiceId ?? ''),
    enabled: !!practiceId,
    queryFn: () => fetchPatients(practiceId!),
  })

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<PatientForm>({
    defaultValues: EMPTY_FORM,
  })

  const saveMutation = useMutation({
    mutationFn: async ({ values, id }: { values: PatientForm; id?: string }) => {
      const payload = {
        first_name: values.first_name,
        last_name: values.last_name,
        dob: toNullable(values.dob),
        sex: (toNullable(values.sex) as Patient['sex']),
        email: toNullable(values.email),
        phone: toNullable(values.phone),
        guardian_name: toNullable(values.guardian_name),
        guardian_email: toNullable(values.guardian_email),
        guardian_phone: toNullable(values.guardian_phone),
        school: toNullable(values.school),
        grade: toNullable(values.grade),
        chief_complaint: toNullable(values.chief_complaint),
        referral_source: toNullable(values.referral_source),
        allied_health_notes: toNullable(values.allied_health_notes),
      }
      if (id) {
        const { error } = await supabase.from('patients').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('patients').insert({ ...payload, practice_id: practiceId! })
        if (error) throw error
      }
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: qk.patients(practiceId!) })
      toast.success(id ? 'Patient updated' : 'Patient added')
      setDialogOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('patients').update({ is_archived: true }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.patients(practiceId!) })
      toast.success('Patient archived')
      setArchiveId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const filtered = patients.filter((p) =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()),
  )

  function openAdd() {
    setEditingPatient(null)
    reset(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(p: Patient) {
    setEditingPatient(p)
    reset(patientToForm(p))
    setDialogOpen(true)
  }

  function onSubmit(values: PatientForm) {
    saveMutation.mutate({ values, id: editingPatient?.id })
  }

  return (
    <div className="flex-1 p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Patients</h1>
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-1" /> Add Patient
        </Button>
      </div>

      <div className="relative max-w-sm mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search patients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {patients.length === 0 ? 'No patients yet. Add your first patient.' : 'No patients match your search.'}
        </p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">DOB</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Chief Complaint</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/patients/${p.id}`)}
                >
                  <td className="px-4 py-3 font-medium">{p.last_name}, {p.first_name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {p.dob ? format(parseISO(p.dob), 'd MMM yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {p.phone ?? p.email ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell truncate max-w-xs">
                    {p.chief_complaint ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(p) }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setArchiveId(p.id) }}>
                        <Archive className="w-4 h-4" />
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPatient ? 'Edit Patient' : 'Add Patient'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-6 pb-2">
                <Section title="Basic Info">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="First Name *">
                      <Input {...register('first_name', { required: true })} className={errors.first_name ? 'border-destructive' : ''} />
                    </Field>
                    <Field label="Last Name *">
                      <Input {...register('last_name', { required: true })} className={errors.last_name ? 'border-destructive' : ''} />
                    </Field>
                    <Field label="Date of Birth">
                      <Input type="date" {...register('dob')} />
                    </Field>
                    <Field label="Sex">
                      <Controller
                        name="sex"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                  </div>
                </Section>

                <Section title="Contact">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Email"><Input type="email" {...register('email')} /></Field>
                    <Field label="Phone"><Input {...register('phone')} /></Field>
                  </div>
                </Section>

                <Section title="Guardian / Parent">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Name"><Input {...register('guardian_name')} /></Field>
                    <Field label="Phone"><Input {...register('guardian_phone')} /></Field>
                    <div className="col-span-2">
                      <Field label="Email"><Input type="email" {...register('guardian_email')} /></Field>
                    </div>
                  </div>
                </Section>

                <Section title="School">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="School"><Input {...register('school')} /></Field>
                    <Field label="Grade / Year"><Input {...register('grade')} /></Field>
                  </div>
                </Section>

                <Section title="Clinical">
                  <div className="space-y-4">
                    <Field label="Chief Complaint">
                      <Controller
                        name="chief_complaint"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="reading_difficulties">Reading difficulties</SelectItem>
                              <SelectItem value="headaches">Headaches / eye strain</SelectItem>
                              <SelectItem value="double_vision">Double vision</SelectItem>
                              <SelectItem value="convergence_insufficiency">Convergence insufficiency</SelectItem>
                              <SelectItem value="crossed_eyes">Crossed eyes (strabismus)</SelectItem>
                              <SelectItem value="lazy_eye">Lazy eye (amblyopia)</SelectItem>
                              <SelectItem value="learning_difficulties">Learning difficulties</SelectItem>
                              <SelectItem value="tracking_problems">Tracking problems</SelectItem>
                              <SelectItem value="sports_performance">Sports performance</SelectItem>
                              <SelectItem value="post_concussion">Post-concussion vision</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                    <Field label="Referral Source">
                      <Controller
                        name="referral_source"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="self">Self / family</SelectItem>
                              <SelectItem value="gp">GP / family doctor</SelectItem>
                              <SelectItem value="optometrist">Optometrist</SelectItem>
                              <SelectItem value="pediatrician">Pediatrician</SelectItem>
                              <SelectItem value="teacher_school">Teacher / school</SelectItem>
                              <SelectItem value="ot">Occupational therapist</SelectItem>
                              <SelectItem value="psychologist">Psychologist</SelectItem>
                              <SelectItem value="neurologist">Neurologist</SelectItem>
                              <SelectItem value="word_of_mouth">Word of mouth</SelectItem>
                              <SelectItem value="online">Online / website</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                    <Field label="Allied Health Notes">
                      <Textarea rows={3} {...register('allied_health_notes')} />
                    </Field>
                  </div>
                </Section>
              </div>
            </ScrollArea>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {editingPatient ? 'Save Changes' : 'Add Patient'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!archiveId} onOpenChange={(o) => !o && setArchiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive patient?</AlertDialogTitle>
            <AlertDialogDescription>
              This patient will be hidden from the list. You can restore them later from Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveId && archiveMutation.mutate(archiveId)}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </section>
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
