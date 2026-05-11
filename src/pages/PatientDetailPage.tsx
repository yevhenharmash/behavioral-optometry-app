import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { format, parseISO, differenceInWeeks, differenceInYears } from 'date-fns'
import {
  ArrowLeft, Pencil, Calendar, Activity, FlaskConical, ClipboardList,
  Plus, Clock, Check, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  fetchPatient, fetchPatientAppointments, fetchVtPrograms,
  fetchRxs, fetchApptNotes, qk,
  type Patient, type AppointmentWithPatient,
} from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { usePracticeId } from '@/lib/practice'

// ─── shared label maps ────────────────────────────────────────────────────────
const APPT_LABELS: Record<string, string> = {
  initial_eval: 'Initial Eval',
  therapy_session: 'Therapy',
  progress_check: 'Progress Check',
  consultation: 'Consultation',
  follow_up: 'Follow-up',
}

const APPT_COLORS: Record<string, string> = {
  initial_eval: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  therapy_session: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  progress_check: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  consultation: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  follow_up: 'bg-muted text-muted-foreground',
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  no_show: 'No Show',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  no_show: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-muted text-muted-foreground',
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function toNullable(s: string): string | null {
  return s.trim() === '' ? null : s.trim()
}

function toNullableNum(s: string): number | null {
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function age(dob: string): string {
  return `${differenceInYears(new Date(), parseISO(dob))} y/o`
}

function rxSide(
  sph: number | null, cyl: number | null, axis: number | null, add: number | null,
): string {
  if (sph == null && cyl == null) return '—'
  const parts: string[] = []
  if (sph != null) parts.push(`${sph >= 0 ? '+' : ''}${sph.toFixed(2)}`)
  if (cyl != null) parts.push(`${cyl >= 0 ? '+' : ''}${cyl.toFixed(2)} ×${axis ?? '?'}`)
  if (add != null) parts.push(`add +${add.toFixed(2)}`)
  return parts.join(' / ')
}

// ─── sub-components ───────────────────────────────────────────────────────────

/** Plain row for overview section */
function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm">{value || '—'}</span>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 mt-6 first:mt-0">
      {title}
    </h3>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────
function OverviewTab({ patient }: { patient: Patient }) {
  return (
    <div className="max-w-xl">
      <SectionHeader title="Clinical" />
      <InfoRow label="Chief Complaint" value={patient.chief_complaint} />
      <InfoRow label="Referral Source" value={patient.referral_source} />
      <InfoRow label="Allied Health Notes" value={patient.allied_health_notes} />

      <SectionHeader title="Contact" />
      <InfoRow label="Email" value={patient.email} />
      <InfoRow label="Phone" value={patient.phone} />

      {(patient.guardian_name || patient.guardian_phone || patient.guardian_email) && (
        <>
          <SectionHeader title="Guardian / Parent" />
          <InfoRow label="Name" value={patient.guardian_name} />
          <InfoRow label="Phone" value={patient.guardian_phone} />
          <InfoRow label="Email" value={patient.guardian_email} />
        </>
      )}

      {(patient.school || patient.grade) && (
        <>
          <SectionHeader title="School" />
          <InfoRow label="School" value={patient.school} />
          <InfoRow label="Grade / Year" value={patient.grade} />
        </>
      )}
    </div>
  )
}

// ─── Appointment notes dialog ─────────────────────────────────────────────────
type NotesForm = {
  status: string
  free_text: string
  in_office_observations: string
}

function ApptNotesDialog({
  appt,
  open,
  onClose,
}: {
  appt: AppointmentWithPatient
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()

  const { data: notes, isLoading } = useQuery({
    queryKey: qk.apptNotes(appt.id),
    enabled: open,
    queryFn: () => fetchApptNotes(appt.id),
  })

  const { register, handleSubmit, control, reset } = useForm<NotesForm>({
    values: {
      status: appt.status,
      free_text: notes?.examNote?.free_text ?? '',
      in_office_observations: notes?.therapySession?.in_office_observations ?? '',
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (values: NotesForm) => {
      const { error: apptErr } = await supabase
        .from('appointments')
        .update({ status: values.status as AppointmentWithPatient['status'] })
        .eq('id', appt.id)
      if (apptErr) throw apptErr

      if (notes?.examNote) {
        const { error } = await supabase
          .from('exam_notes')
          .update({ free_text: toNullable(values.free_text), data: {} })
          .eq('id', notes.examNote.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('exam_notes').insert({
          appointment_id: appt.id,
          template_key: 'general',
          data: {},
          free_text: toNullable(values.free_text),
        })
        if (error) throw error
      }

      if (appt.type === 'therapy_session') {
        if (notes?.therapySession) {
          const { error } = await supabase
            .from('therapy_sessions')
            .update({ in_office_observations: toNullable(values.in_office_observations) })
            .eq('id', notes.therapySession.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('therapy_sessions').insert({
            appointment_id: appt.id,
            vt_program_id: null,
            in_office_observations: toNullable(values.in_office_observations),
          })
          if (error) throw error
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.apptNotes(appt.id) })
      queryClient.invalidateQueries({ queryKey: ['patient-appointments'] })
      toast.success('Notes saved')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function handleClose() {
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {APPT_LABELS[appt.type]} — {format(parseISO(appt.starts_at), 'd MMM yyyy, h:mm a')}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : (
          <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
            <FormField label="Status">
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Notes">
              <Textarea
                rows={5}
                placeholder="Exam findings, observations, plan…"
                {...register('free_text')}
              />
            </FormField>

            {appt.type === 'therapy_session' && (
              <FormField label="In-office Observations">
                <Textarea
                  rows={3}
                  placeholder="Activities completed, patient response…"
                  {...register('in_office_observations')}
                />
              </FormField>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>Save Notes</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Appointments tab ─────────────────────────────────────────────────────────
function AppointmentsTab({ patientId, practiceId }: { patientId: string; practiceId: string }) {
  const queryClient = useQueryClient()
  const [notesAppt, setNotesAppt] = useState<AppointmentWithPatient | null>(null)
  const [apptDialogOpen, setApptDialogOpen] = useState(false)

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: qk.patientAppointments(patientId),
    queryFn: () => fetchPatientAppointments(patientId),
  })

  type ApptForm = { date: string; time: string; duration_min: string; type: string; status: string }
  const { register, handleSubmit, control, reset } = useForm<ApptForm>({
    defaultValues: { date: '', time: '09:00', duration_min: '60', type: 'therapy_session', status: 'scheduled' },
  })

  const createMutation = useMutation({
    mutationFn: async (values: ApptForm) => {
      const starts_at = new Date(`${values.date}T${values.time}:00`).toISOString()
      const { error } = await supabase.from('appointments').insert({
        practice_id: practiceId,
        patient_id: patientId,
        starts_at,
        duration_min: Number(values.duration_min),
        type: values.type as AppointmentWithPatient['type'],
        status: values.status as AppointmentWithPatient['status'],
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.patientAppointments(patientId) })
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Appointment created')
      setApptDialogOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => { reset(); setApptDialogOpen(true) }}>
          <Plus className="w-4 h-4 mr-1" /> New Appointment
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : appointments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No appointments yet.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date & Time</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Duration</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setNotesAppt(a)}
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground flex-none" />
                      {format(parseISO(a.starts_at), 'd MMM yyyy, h:mm a')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${APPT_COLORS[a.type]}`}>
                      {APPT_LABELS[a.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[a.status]}`}>
                      {STATUS_LABELS[a.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{a.duration_min} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {notesAppt && (
        <ApptNotesDialog
          appt={notesAppt}
          open={!!notesAppt}
          onClose={() => setNotesAppt(null)}
        />
      )}

      <Dialog open={apptDialogOpen} onOpenChange={setApptDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Appointment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Date *">
                <Input type="date" {...register('date', { required: true })} />
              </FormField>
              <FormField label="Time *">
                <Input type="time" {...register('time', { required: true })} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Duration">
                <Controller name="duration_min" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="45">45 min</SelectItem>
                      <SelectItem value="60">60 min</SelectItem>
                      <SelectItem value="90">90 min</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </FormField>
              <FormField label="Type">
                <Controller name="type" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(APPT_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
              </FormField>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setApptDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── VT Program tab ───────────────────────────────────────────────────────────
type ProgramForm = { diagnosis: string; goals: string }

function VtProgramTab({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient()
  const [startOpen, setStartOpen] = useState(false)
  const [endConfirmId, setEndConfirmId] = useState<string | null>(null)

  const { data: programs = [], isLoading } = useQuery({
    queryKey: qk.vtProgram(patientId),
    queryFn: () => fetchVtPrograms(patientId),
  })

  const active = programs.find((p) => !p.ended_at) ?? null

  const { register, handleSubmit, reset } = useForm<ProgramForm>({
    defaultValues: { diagnosis: '', goals: '' },
  })

  const startMutation = useMutation({
    mutationFn: async (values: ProgramForm) => {
      const goals = values.goals
        .split('\n')
        .map((g) => g.trim())
        .filter(Boolean)
      const { error } = await supabase.from('vt_programs').insert({
        patient_id: patientId,
        diagnosis: values.diagnosis,
        goals,
        ended_at: null,
        source_template_key: null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.vtProgram(patientId) })
      queryClient.invalidateQueries({ queryKey: ['today-stats'] })
      toast.success('VT Program started')
      setStartOpen(false)
      reset()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const endMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('vt_programs')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.vtProgram(patientId) })
      queryClient.invalidateQueries({ queryKey: ['today-stats'] })
      toast.success('Program ended')
      setEndConfirmId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div>
      {active ? (
        <div className="border border-border rounded-lg p-5 max-w-xl">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Active Program</p>
              <h3 className="text-base font-semibold">{active.diagnosis}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Started {format(parseISO(active.started_at), 'd MMM yyyy')}
                {' · '}
                {differenceInWeeks(new Date(), parseISO(active.started_at))} weeks
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive flex-none"
              onClick={() => setEndConfirmId(active.id)}
            >
              <X className="w-3.5 h-3.5 mr-1" /> End Program
            </Button>
          </div>

          {Array.isArray(active.goals) && (active.goals as string[]).length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Goals</p>
              <ul className="space-y-1.5">
                {(active.goals as string[]).map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-none" />
                    {g}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">No active VT program.</p>
          <Button size="sm" onClick={() => setStartOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Start Program
          </Button>
        </div>
      )}

      {programs.filter((p) => p.ended_at).length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Past Programs</p>
          <div className="border border-border rounded-lg overflow-hidden max-w-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Diagnosis</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Started</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Ended</th>
                </tr>
              </thead>
              <tbody>
                {programs.filter((p) => p.ended_at).map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">{p.diagnosis}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{format(parseISO(p.started_at), 'd MMM yyyy')}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.ended_at ? format(parseISO(p.ended_at), 'd MMM yyyy') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Start VT Program</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((v) => startMutation.mutate(v))} className="space-y-4">
            <FormField label="Diagnosis *">
              <Input placeholder="e.g. Convergence Insufficiency" {...register('diagnosis', { required: true })} />
            </FormField>
            <FormField label="Goals (one per line)">
              <Textarea rows={4} placeholder="Improve fusional vergence range&#10;Reduce asthenopia&#10;…" {...register('goals')} />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStartOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={startMutation.isPending}>Start</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!endConfirmId} onOpenChange={(o) => !o && setEndConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this program?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the program as completed. You can start a new one anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => endConfirmId && endMutation.mutate(endConfirmId)}>
              End Program
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Rx tab ───────────────────────────────────────────────────────────────────
type RxForm = {
  od_sph: string; od_cyl: string; od_axis: string; od_add: string
  os_sph: string; os_cyl: string; os_axis: string; os_add: string
  pd_binocular: string; notes: string
}

const EMPTY_RX: RxForm = {
  od_sph: '', od_cyl: '', od_axis: '', od_add: '',
  os_sph: '', os_cyl: '', os_axis: '', os_add: '',
  pd_binocular: '', notes: '',
}

function RxTab({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)

  const { data: rxs = [], isLoading } = useQuery({
    queryKey: qk.rxs(patientId),
    queryFn: () => fetchRxs(patientId),
  })

  const { register, handleSubmit, reset } = useForm<RxForm>({ defaultValues: EMPTY_RX })

  const saveMutation = useMutation({
    mutationFn: async (values: RxForm) => {
      const { error } = await supabase.from('rxs').insert({
        patient_id: patientId,
        od_sph: toNullableNum(values.od_sph),
        od_cyl: toNullableNum(values.od_cyl),
        od_axis: toNullableNum(values.od_axis),
        od_add: toNullableNum(values.od_add),
        od_prism: null,
        od_base: null,
        os_sph: toNullableNum(values.os_sph),
        os_cyl: toNullableNum(values.os_cyl),
        os_axis: toNullableNum(values.os_axis),
        os_add: toNullableNum(values.os_add),
        os_prism: null,
        os_base: null,
        pd_binocular: toNullableNum(values.pd_binocular),
        pd_od: null,
        pd_os: null,
        notes: toNullable(values.notes),
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.rxs(patientId) })
      toast.success('Rx saved')
      setAddOpen(false)
      reset()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => { reset(); setAddOpen(true) }}>
          <Plus className="w-4 h-4 mr-1" /> Add Rx
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rxs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No prescriptions recorded.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">OD</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">OS</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">PD</th>
              </tr>
            </thead>
            <tbody>
              {rxs.map((rx) => (
                <tr key={rx.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-muted-foreground">{format(parseISO(rx.captured_at), 'd MMM yyyy')}</td>
                  <td className="px-4 py-3 font-mono text-xs">{rxSide(rx.od_sph, rx.od_cyl, rx.od_axis, rx.od_add)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{rxSide(rx.os_sph, rx.os_cyl, rx.os_axis, rx.os_add)}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{rx.pd_binocular ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Prescription</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
            <ScrollArea className="h-[55vh] pr-4">
              <div className="space-y-6 pb-2">
                <RxEyeSection side="OD" register={register} prefix="od_" />
                <RxEyeSection side="OS" register={register} prefix="os_" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">PD</p>
                  <FormField label="PD (binocular)">
                    <Input type="number" step="0.5" placeholder="62" {...register('pd_binocular')} className="max-w-[120px]" />
                  </FormField>
                </div>
                <FormField label="Notes">
                  <Textarea rows={2} {...register('notes')} />
                </FormField>
              </div>
            </ScrollArea>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>Save Rx</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RxEyeSection({
  side,
  register,
  prefix,
}: {
  side: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any
  prefix: string
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{side}</p>
      <div className="grid grid-cols-4 gap-3">
        <FormField label="Sph">
          <Input type="number" step="0.25" placeholder="0.00" {...register(`${prefix}sph`)} />
        </FormField>
        <FormField label="Cyl">
          <Input type="number" step="0.25" placeholder="0.00" {...register(`${prefix}cyl`)} />
        </FormField>
        <FormField label="Axis">
          <Input type="number" step="1" placeholder="0" {...register(`${prefix}axis`)} />
        </FormField>
        <FormField label="Add">
          <Input type="number" step="0.25" placeholder="0.00" {...register(`${prefix}add`)} />
        </FormField>
      </div>
    </div>
  )
}

// ─── Edit patient dialog (inline) ─────────────────────────────────────────────
type PatientForm = {
  first_name: string; last_name: string; dob: string; sex: string
  email: string; phone: string; guardian_name: string; guardian_email: string
  guardian_phone: string; school: string; grade: string
  chief_complaint: string; referral_source: string; allied_health_notes: string
}

function patientToForm(p: Patient): PatientForm {
  return {
    first_name: p.first_name, last_name: p.last_name,
    dob: p.dob ?? '', sex: p.sex ?? '', email: p.email ?? '', phone: p.phone ?? '',
    guardian_name: p.guardian_name ?? '', guardian_email: p.guardian_email ?? '',
    guardian_phone: p.guardian_phone ?? '', school: p.school ?? '', grade: p.grade ?? '',
    chief_complaint: p.chief_complaint ?? '', referral_source: p.referral_source ?? '',
    allied_health_notes: p.allied_health_notes ?? '',
  }
}

function EditPatientDialog({
  patient, open, onClose,
}: { patient: Patient; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, control } = useForm<PatientForm>({
    values: patientToForm(patient),
  })

  const saveMutation = useMutation({
    mutationFn: async (values: PatientForm) => {
      const { error } = await supabase.from('patients').update({
        first_name: values.first_name, last_name: values.last_name,
        dob: toNullable(values.dob), sex: (toNullable(values.sex) as Patient['sex']),
        email: toNullable(values.email), phone: toNullable(values.phone),
        guardian_name: toNullable(values.guardian_name),
        guardian_email: toNullable(values.guardian_email),
        guardian_phone: toNullable(values.guardian_phone),
        school: toNullable(values.school), grade: toNullable(values.grade),
        chief_complaint: toNullable(values.chief_complaint),
        referral_source: toNullable(values.referral_source),
        allied_health_notes: toNullable(values.allied_health_notes),
      }).eq('id', patient.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.patient(patient.id) })
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast.success('Patient updated')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Patient</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-6 pb-2">
              <EditSection title="Basic Info">
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="First Name *"><Input {...register('first_name', { required: true })} /></FormField>
                  <FormField label="Last Name *"><Input {...register('last_name', { required: true })} /></FormField>
                  <FormField label="Date of Birth"><Input type="date" {...register('dob')} /></FormField>
                  <FormField label="Sex">
                    <Controller name="sex" control={control} render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                          <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    )} />
                  </FormField>
                </div>
              </EditSection>
              <EditSection title="Contact">
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Email"><Input type="email" {...register('email')} /></FormField>
                  <FormField label="Phone"><Input {...register('phone')} /></FormField>
                </div>
              </EditSection>
              <EditSection title="Guardian / Parent">
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Name"><Input {...register('guardian_name')} /></FormField>
                  <FormField label="Phone"><Input {...register('guardian_phone')} /></FormField>
                  <div className="col-span-2">
                    <FormField label="Email"><Input type="email" {...register('guardian_email')} /></FormField>
                  </div>
                </div>
              </EditSection>
              <EditSection title="School">
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="School"><Input {...register('school')} /></FormField>
                  <FormField label="Grade / Year"><Input {...register('grade')} /></FormField>
                </div>
              </EditSection>
              <EditSection title="Clinical">
                <div className="space-y-4">
                  <FormField label="Chief Complaint"><Input {...register('chief_complaint')} /></FormField>
                  <FormField label="Referral Source"><Input {...register('referral_source')} /></FormField>
                  <FormField label="Allied Health Notes"><Textarea rows={3} {...register('allied_health_notes')} /></FormField>
                </div>
              </EditSection>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </section>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: practiceId } = usePracticeId()
  const [editOpen, setEditOpen] = useState(false)

  const { data: patient, isLoading, isError } = useQuery({
    queryKey: qk.patient(id!),
    enabled: !!id,
    queryFn: () => fetchPatient(id!),
  })

  if (isLoading) {
    return <div className="flex-1 p-8 text-sm text-muted-foreground">Loading…</div>
  }

  if (isError || !patient) {
    return <div className="flex-1 p-8 text-sm text-muted-foreground">Patient not found.</div>
  }

  return (
    <div className="flex-1 p-6 md:p-8 max-w-4xl">
      {/* Back */}
      <button
        onClick={() => navigate('/patients')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Patients
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">
            {patient.first_name} {patient.last_name}
          </h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {patient.dob && (
              <span className="text-sm text-muted-foreground">
                {format(parseISO(patient.dob), 'd MMM yyyy')} · {age(patient.dob)}
              </span>
            )}
            {patient.sex && (
              <Badge variant="outline" className="capitalize text-xs">
                {patient.sex.replace('_', ' ')}
              </Badge>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview" className="gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="appointments" className="gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Appointments
          </TabsTrigger>
          <TabsTrigger value="vt-program" className="gap-1.5">
            <Activity className="w-3.5 h-3.5" /> VT Program
          </TabsTrigger>
          <TabsTrigger value="rx" className="gap-1.5">
            <FlaskConical className="w-3.5 h-3.5" /> Rx
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab patient={patient} />
        </TabsContent>

        <TabsContent value="appointments">
          <AppointmentsTab patientId={patient.id} practiceId={practiceId ?? ''} />
        </TabsContent>

        <TabsContent value="vt-program">
          <VtProgramTab patientId={patient.id} />
        </TabsContent>

        <TabsContent value="rx">
          <RxTab patientId={patient.id} />
        </TabsContent>
      </Tabs>

      <EditPatientDialog patient={patient} open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  )
}

// ─── shared form helpers ──────────────────────────────────────────────────────
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  )
}
