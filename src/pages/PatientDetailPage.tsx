import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { format, parseISO, differenceInWeeks, differenceInYears, addDays } from 'date-fns'
import {
  ArrowLeft, Pencil, Calendar, Activity as ActivityIcon, FlaskConical, ClipboardList,
  Plus, Clock, Check, X, Trash2, BarChart2, Star, Trophy, Link2, Copy, Mail,
  Timer, Play, Pause, RotateCcw, ChevronDown, ChevronUp, Wand2, FileDown,
} from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { SummaryPdf } from '@/lib/pdf/SummaryPdf'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  fetchPatient, fetchPatientAppointments, fetchVtPrograms,
  fetchRxs, fetchApptNotes, fetchActivities, fetchSessionActivities, fetchSurveyResponses,
  fetchReferrers, fetchPatientReferrers, fetchAchievementEntries, fetchIntakeLinks,
  fetchPractice, qk,
  type Patient, type AppointmentWithPatient, type Activity, type AchievementEntry,
} from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { usePracticeId } from '@/lib/practice'
import { useAuth } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'
import { EmptyState } from '@/components/EmptyState'

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
function OverviewTab({ patient, practiceId }: { patient: Patient; practiceId: string }) {
  const queryClient = useQueryClient()
  const [linkOpen, setLinkOpen] = useState(false)

  const { data: linkedReferrers = [] } = useQuery({
    queryKey: qk.patientReferrers(patient.id),
    queryFn: () => fetchPatientReferrers(patient.id),
  })

  const { data: allReferrers = [] } = useQuery({
    queryKey: qk.referrers(practiceId),
    enabled: linkOpen,
    queryFn: () => fetchReferrers(practiceId),
  })

  const linkMutation = useMutation({
    mutationFn: async (referrerId: string) => {
      const { error } = await supabase
        .from('patient_referrers')
        .insert({ patient_id: patient.id, referrer_id: referrerId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.patientReferrers(patient.id) })
      toast.success('Referrer linked')
      setLinkOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const unlinkMutation = useMutation({
    mutationFn: async (referrerId: string) => {
      const { error } = await supabase
        .from('patient_referrers')
        .delete()
        .eq('patient_id', patient.id)
        .eq('referrer_id', referrerId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.patientReferrers(patient.id) }),
    onError: (e: Error) => toast.error(e.message),
  })

  const linkedIds = new Set(linkedReferrers.map((r) => r.id))
  const linkable = allReferrers.filter((r) => !linkedIds.has(r.id))

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

      <div className="mt-6 flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Referring Practitioners</h3>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setLinkOpen(true)}>
          <Plus className="w-3 h-3 mr-1" /> Link
        </Button>
      </div>

      {linkedReferrers.length === 0 ? (
        <p className="text-sm text-muted-foreground">None linked.</p>
      ) : (
        <ul className="space-y-2">
          {linkedReferrers.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-md border border-border p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">{[r.role, r.email].filter(Boolean).join(' · ')}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive flex-none"
                onClick={() => unlinkMutation.mutate(r.id)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Link Referring Practitioner</DialogTitle>
          </DialogHeader>
          {allReferrers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No referrers in your practice yet. Add some on the Referrers page first.
            </p>
          ) : linkable.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">All referrers are already linked to this patient.</p>
          ) : (
            <ul className="space-y-1.5 py-2">
              {linkable.map((r) => (
                <li key={r.id}>
                  <button
                    className="w-full text-left rounded-md border border-border p-3 hover:bg-muted/40 transition-colors"
                    onClick={() => linkMutation.mutate(r.id)}
                  >
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{[r.role, r.email].filter(Boolean).join(' · ')}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IntakeLinkSection patient={patient} practiceId={practiceId} />
    </div>
  )
}

// ─── Appointment notes dialog ─────────────────────────────────────────────────
type NotesForm = {
  status: string
  free_text: string
  in_office_observations: string
  summary_email_body: string
  summary_referrer_body: string
}

type ActivityLogForm = {
  activity_id: string
  level_label: string
  duration_min: string
  performance: string
  observations: string
}

const EMPTY_ACTIVITY_LOG: ActivityLogForm = {
  activity_id: '', level_label: '', duration_min: '', performance: '', observations: '',
}

const CATEGORY_LABELS: Record<string, string> = {
  vergence: 'Vergence', accommodation: 'Accommodation', tracking: 'Tracking',
  saccades: 'Saccades', stereopsis: 'Stereopsis', visual_motor: 'Visual Motor',
  visual_processing: 'Visual Processing',
}

async function getOrCreateTherapySession(apptId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('therapy_sessions')
    .select('id')
    .eq('appointment_id', apptId)
    .maybeSingle()
  if (existing) return existing.id
  const { data: created, error } = await supabase
    .from('therapy_sessions')
    .insert({ appointment_id: apptId, vt_program_id: null, in_office_observations: null })
    .select('id')
    .single()
  if (error) throw error
  return created.id
}

function ActivityLogSection({
  apptId,
  practiceId,
  therapySessionId,
}: {
  apptId: string
  practiceId: string
  therapySessionId: string | null
}) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const { register, handleSubmit, reset, watch, setValue } = useForm<ActivityLogForm>({
    defaultValues: EMPTY_ACTIVITY_LOG,
  })

  const { data: allActivities = [] } = useQuery({
    queryKey: qk.activities(practiceId),
    enabled: !!practiceId,
    queryFn: () => fetchActivities(practiceId),
  })

  const { data: sessionActivities = [], refetch: refetchSessionActivities } = useQuery({
    queryKey: qk.sessionActivities(therapySessionId ?? ''),
    enabled: !!therapySessionId,
    queryFn: () => fetchSessionActivities(therapySessionId!),
  })

  const watchedActivityId = watch('activity_id')
  const selectedActivity = allActivities.find((a) => a.id === watchedActivityId)
  const levels = Array.isArray(selectedActivity?.levels)
    ? (selectedActivity.levels as { label: string; description: string }[])
    : []

  const addMutation = useMutation({
    mutationFn: async (values: ActivityLogForm) => {
      const tsId = therapySessionId ?? (await getOrCreateTherapySession(apptId))
      const { error } = await supabase.from('activity_assignments').insert({
        therapy_session_id: tsId,
        activity_id: values.activity_id,
        mode: 'in_office',
        level_label: toNullable(values.level_label),
        duration_min: values.duration_min ? Number(values.duration_min) : null,
        performance: values.performance ? Number(values.performance) : null,
        observations: toNullable(values.observations),
        widget_run_id: null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.apptNotes(apptId) })
      refetchSessionActivities()
      toast.success('Activity logged')
      setAddOpen(false)
      reset(EMPTY_ACTIVITY_LOG)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('activity_assignments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      refetchSessionActivities()
      toast.success('Activity removed')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Group activities by category for the select
  const grouped = allActivities.reduce<Record<string, Activity[]>>((acc, a) => {
    ;(acc[a.category] ??= []).push(a)
    return acc
  }, {})

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activities</p>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="w-3 h-3 mr-1" /> Log Activity
        </Button>
      </div>

      {sessionActivities.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No activities logged yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {sessionActivities.map((sa) => (
            <li key={sa.id} className="flex items-start gap-2 rounded-md border border-border p-2 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{sa.activities.name}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                  {sa.level_label && <span>Level: {sa.level_label}</span>}
                  {sa.duration_min && <span>{sa.duration_min} min</span>}
                  {sa.performance != null && (
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-2.5 h-2.5 ${i < (sa.performance ?? 0) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
                        />
                      ))}
                    </span>
                  )}
                </div>
                {sa.observations && <p className="text-xs text-muted-foreground mt-0.5">{sa.observations}</p>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-none text-muted-foreground hover:text-destructive"
                onClick={() => removeMutation.mutate(sa.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Log Activity</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((v) => addMutation.mutate(v))} className="space-y-3">
            <FormField label="Activity *">
              <Select
                value={watchedActivityId}
                onValueChange={(v) => { setValue('activity_id', v); setValue('level_label', '') }}
              >
                <SelectTrigger><SelectValue placeholder="Select activity…" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([cat, catLabel]) => {
                    const group = grouped[cat]
                    if (!group?.length) return null
                    return (
                      <div key={cat}>
                        <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{catLabel}</p>
                        {group.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </div>
                    )
                  })}
                </SelectContent>
              </Select>
            </FormField>

            {levels.length > 0 ? (
              <FormField label="Level">
                <Select value={watch('level_label')} onValueChange={(v) => setValue('level_label', v)}>
                  <SelectTrigger><SelectValue placeholder="Select level…" /></SelectTrigger>
                  <SelectContent>
                    {levels.map((l) => (
                      <SelectItem key={l.label} value={l.label}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            ) : (
              <FormField label="Level">
                <Input placeholder="e.g. Level 2" {...register('level_label')} />
              </FormField>
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Duration (min)">
                <Input type="number" min="1" placeholder="30" {...register('duration_min')} />
              </FormField>
              <FormField label="Performance (1–5)">
                <Input type="number" min="1" max="5" placeholder="4" {...register('performance')} />
              </FormField>
            </div>

            <FormField label="Observations">
              <Textarea rows={2} placeholder="Patient response, notes…" {...register('observations')} />
            </FormField>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setAddOpen(false); reset(EMPTY_ACTIVITY_LOG) }}>Cancel</Button>
              <Button type="submit" disabled={addMutation.isPending || !watchedActivityId}>Log</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ApptNotesDialog({
  appt,
  open,
  onClose,
  practiceId,
  patient,
}: {
  appt: AppointmentWithPatient
  open: boolean
  onClose: () => void
  practiceId: string
  patient: Patient
}) {
  const queryClient = useQueryClient()

  const { data: notes, isLoading } = useQuery({
    queryKey: qk.apptNotes(appt.id),
    enabled: open,
    queryFn: () => fetchApptNotes(appt.id),
  })

  // Lift sessionActivities so SummaryComposer can access them
  const { data: sessionActivitiesRaw = [] } = useQuery({
    queryKey: qk.sessionActivities(notes?.therapySession?.id ?? ''),
    enabled: !!notes?.therapySession?.id,
    queryFn: () => fetchSessionActivities(notes!.therapySession!.id),
  })

  // Fetch activity detail (for demo_video_url) — activities are already in allActivities
  const { data: allActivities = [] } = useQuery({
    queryKey: qk.activities(practiceId),
    enabled: !!practiceId,
    queryFn: () => fetchActivities(practiceId),
  })

  const activitiesForSummary = sessionActivitiesRaw.map((sa) => {
    const full = allActivities.find((a) => a.id === sa.activity_id)
    return {
      name: sa.activities.name,
      level_label: sa.level_label,
      observations: sa.observations,
      demo_video_url: full?.demo_video_url ?? null,
    }
  })

  const [parentBody, setParentBody] = useState(appt.summary_email_body ?? '')
  const [referrerBody, setReferrerBody] = useState(appt.summary_referrer_body ?? '')

  const { register, handleSubmit, control, reset } = useForm<NotesForm>({
    values: {
      status: appt.status,
      free_text: notes?.examNote?.free_text ?? '',
      in_office_observations: notes?.therapySession?.in_office_observations ?? '',
      summary_email_body: appt.summary_email_body ?? '',
      summary_referrer_body: appt.summary_referrer_body ?? '',
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (values: NotesForm) => {
      const { error: apptErr } = await supabase
        .from('appointments')
        .update({
          status: values.status as AppointmentWithPatient['status'],
          summary_email_body: toNullable(parentBody),
          summary_referrer_body: toNullable(referrerBody),
        })
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {APPT_LABELS[appt.type]} — {format(parseISO(appt.starts_at), 'd MMM yyyy, h:mm a')}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : (
          <ScrollArea className="max-h-[80vh]">
            <div className="space-y-4 pr-1">
              {/* Session timer — therapy sessions only */}
              {appt.type === 'therapy_session' && (
                <SessionTimer durationMin={appt.duration_min} />
              )}

              <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4" id="appt-notes-form">
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
                    rows={4}
                    placeholder="Exam findings, observations, plan…"
                    {...register('free_text')}
                  />
                </FormField>

                {appt.type === 'therapy_session' && (
                  <>
                    <FormField label="In-office Observations">
                      <Textarea
                        rows={2}
                        placeholder="General session observations…"
                        {...register('in_office_observations')}
                      />
                    </FormField>

                    <div className="border-t border-border pt-4">
                      <ActivityLogSection
                        apptId={appt.id}
                        practiceId={practiceId}
                        therapySessionId={notes?.therapySession?.id ?? null}
                      />
                    </div>
                  </>
                )}

                <SummaryComposerSection
                  appt={appt}
                  patient={patient}
                  notes={notes}
                  activities={activitiesForSummary}
                  practiceId={practiceId}
                  parentBody={parentBody}
                  referrerBody={referrerBody}
                  onParentBodyChange={setParentBody}
                  onReferrerBodyChange={setReferrerBody}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
                  <Button type="submit" disabled={saveMutation.isPending}>Save Notes</Button>
                </DialogFooter>
              </form>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Appointments tab ─────────────────────────────────────────────────────────
function AppointmentsTab({ patientId, practiceId, patient }: { patientId: string; practiceId: string; patient: Patient }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
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
      const { data, error } = await supabase.from('appointments').insert({
        practice_id: practiceId,
        patient_id: patientId,
        starts_at,
        duration_min: Number(values.duration_min),
        type: values.type as AppointmentWithPatient['type'],
        status: values.status as AppointmentWithPatient['status'],
      }).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: (apptId) => {
      queryClient.invalidateQueries({ queryKey: qk.patientAppointments(patientId) })
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Appointment created')
      if (user) writeAudit(practiceId, user.id, 'create_appointment', 'appointments', apptId)
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
        <EmptyState
          icon={Calendar}
          title="No appointments yet"
          description="Create the first appointment to begin tracking visits."
          action={
            <Button size="sm" onClick={() => { reset(); setApptDialogOpen(true) }}>
              <Plus className="w-4 h-4 mr-1" /> New Appointment
            </Button>
          }
        />
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
          practiceId={practiceId}
          patient={patient}
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
  const { user } = useAuth()
  const { data: practiceId } = usePracticeId()
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
      const { data, error } = await supabase.from('vt_programs').insert({
        patient_id: patientId,
        diagnosis: values.diagnosis,
        goals,
        ended_at: null,
        source_template_key: null,
      }).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: (programId) => {
      queryClient.invalidateQueries({ queryKey: qk.vtProgram(patientId) })
      queryClient.invalidateQueries({ queryKey: ['today-stats'] })
      toast.success('VT Program started')
      if (practiceId && user) {
        writeAudit(practiceId, user.id, 'create_vt_program', 'vt_programs', programId)
      }
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
      return id
    },
    onSuccess: (programId) => {
      queryClient.invalidateQueries({ queryKey: qk.vtProgram(patientId) })
      queryClient.invalidateQueries({ queryKey: ['today-stats'] })
      toast.success('Program ended')
      if (practiceId && user) {
        writeAudit(practiceId, user.id, 'end_vt_program', 'vt_programs', programId)
      }
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
        <EmptyState
          icon={FlaskConical}
          title="No prescriptions recorded"
          description="Add the patient's current spectacle or contact lens Rx."
          action={
            <Button size="sm" onClick={() => { reset(); setAddOpen(true) }}>
              <Plus className="w-4 h-4 mr-1" /> Add Rx
            </Button>
          }
        />
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

// ─── CISS Survey ──────────────────────────────────────────────────────────────
const CISS_ITEMS = [
  'Do your eyes feel tired when reading or doing close work?',
  'Do your eyes feel uncomfortable when reading or doing close work?',
  'Do you have headaches when reading or doing close work?',
  'Do you feel sleepy when reading or doing close work?',
  'Do you lose concentration when reading or doing close work?',
  'Do you have trouble remembering what you have read?',
  'Do you have double vision when reading or doing close work?',
  'Do you see the words move, jump, swim or appear to float on the page?',
  'Do you feel like you read slowly?',
  'Do your eyes ever hurt when reading or doing close work?',
  'Do your eyes ever feel sore when reading or doing close work?',
  'Do you feel a "pulling" feeling around your eyes when reading or doing close work?',
  'Do you notice the words blurring or coming in and out of focus when reading or doing close work?',
  'Do you lose your place while reading or doing close work?',
  'Do you have to re-read the same line of words when reading?',
]

const CISS_OPTIONS = ['Never', 'Infrequently', 'Sometimes', 'Fairly often', 'Always']

type CissForm = Record<string, string>

function CissDialog({ patientId, open, onClose }: { patientId: string; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const defaultValues = Object.fromEntries(CISS_ITEMS.map((_, i) => [`q${i + 1}`, '0']))
  const { register, handleSubmit, watch, reset } = useForm<CissForm>({ defaultValues })
  const values = watch()
  const currentScore = CISS_ITEMS.reduce((sum, _, i) => sum + Number(values[`q${i + 1}`] ?? 0), 0)

  const saveMutation = useMutation({
    mutationFn: async (data: CissForm) => {
      const answers = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, Number(v)])
      )
      const score = Object.values(answers).reduce((s, v) => s + v, 0)
      const { error } = await supabase.from('survey_responses').insert({
        patient_id: patientId,
        survey_key: 'ciss',
        answers,
        score,
        score_label: score >= 16 ? 'Symptomatic' : 'Asymptomatic',
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.surveyResponses(patientId) })
      toast.success('CISS survey saved')
      reset(defaultValues)
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>CISS — Convergence Insufficiency Symptom Survey</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
          <ScrollArea className="h-[65vh] pr-4">
            <div className="space-y-4 pb-4">
              <p className="text-xs text-muted-foreground">
                Rate each symptom from 0 (Never) to 4 (Always). Score ≥ 16 is clinically significant.
              </p>
              {CISS_ITEMS.map((item, i) => (
                <div key={i} className="space-y-1.5">
                  <p className="text-sm">{i + 1}. {item}</p>
                  <div className="flex gap-2 flex-wrap">
                    {CISS_OPTIONS.map((label, score) => (
                      <label key={score} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          value={score}
                          {...register(`q${i + 1}`)}
                          className="accent-primary"
                        />
                        <span className="text-xs text-muted-foreground">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <div>
              <span className="text-sm font-medium">Score: {currentScore} / 60</span>
              <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded ${currentScore >= 16 ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>
                {currentScore >= 16 ? 'Symptomatic' : 'Asymptomatic'}
              </span>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>Save Survey</Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SurveysTab({ patientId }: { patientId: string }) {
  const [cissOpen, setCissOpen] = useState(false)

  const { data: responses = [], isLoading } = useQuery({
    queryKey: qk.surveyResponses(patientId),
    queryFn: () => fetchSurveyResponses(patientId),
  })

  const cissResponses = responses.filter((r) => r.survey_key === 'ciss')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium">CISS — Convergence Insufficiency Symptom Survey</h3>
          <p className="text-xs text-muted-foreground mt-0.5">15 items · Score ≥ 16 = symptomatic</p>
        </div>
        <Button size="sm" onClick={() => setCissOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Take Survey
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : cissResponses.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No CISS surveys yet"
          description="Take the 15-item survey to track convergence insufficiency symptoms over time."
          action={<Button size="sm" onClick={() => setCissOpen(true)}><Plus className="w-4 h-4 mr-1" /> Take Survey</Button>}
        />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden max-w-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Score</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Result</th>
              </tr>
            </thead>
            <tbody>
              {cissResponses.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(parseISO(r.captured_at), 'd MMM yyyy')}
                  </td>
                  <td className="px-4 py-3 font-medium">{r.score} / 60</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${
                      r.score_label === 'Symptomatic'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    }`}>
                      {r.score_label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CissDialog patientId={patientId} open={cissOpen} onClose={() => setCissOpen(false)} />
    </div>
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

// ─── Achievement Report tab (Phase 4b) ───────────────────────────────────────

const ACHIEVEMENT_CATEGORIES: Record<AchievementEntry['category'], string> = {
  reading: 'Reading',
  academic: 'Academic',
  emotional: 'Emotional / Behavioural',
  ocular_symptoms: 'Ocular Symptoms',
  localization: 'Localization',
  goals: 'Goals',
}

const SCALE_LABELS: Record<number, string> = {
  1: 'Very Poor', 2: 'Poor', 3: 'Fair', 4: 'Good', 5: 'Excellent',
}

type AchievementForm = {
  category: AchievementEntry['category']
  item: string
  scale: string
}

function AchievementScaleDots({ scale, baseline }: { scale: number; baseline?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((v) => (
        <div
          key={v}
          className={`w-3 h-3 rounded-full border transition-colors ${
            v <= scale
              ? 'bg-primary border-primary'
              : baseline !== undefined && v <= baseline
              ? 'bg-muted border-border'
              : 'bg-transparent border-border/40'
          }`}
          title={SCALE_LABELS[v]}
        />
      ))}
    </div>
  )
}

function AchievementTab({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)

  const { data: entries = [], isLoading } = useQuery({
    queryKey: qk.achievementEntries(patientId),
    queryFn: () => fetchAchievementEntries(patientId),
  })

  const { register, handleSubmit, reset, watch, setValue } = useForm<AchievementForm>({
    defaultValues: { category: 'reading', item: '', scale: '3' },
  })

  const saveMutation = useMutation({
    mutationFn: async (values: AchievementForm) => {
      const { error } = await supabase.from('achievement_entries').insert({
        patient_id: patientId,
        vt_program_id: null,
        category: values.category,
        item: values.item.trim(),
        scale: Number(values.scale),
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.achievementEntries(patientId) })
      toast.success('Achievement entry saved')
      reset({ category: 'reading', item: '', scale: '3' })
      setAddOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('achievement_entries').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.achievementEntries(patientId) }),
    onError: (e: Error) => toast.error(e.message),
  })

  // Build baseline vs latest map per (category, item)
  const itemMap = new Map<string, { baseline: AchievementEntry; latest: AchievementEntry }>()
  for (const entry of entries) {
    const key = `${entry.category}::${entry.item}`
    if (!itemMap.has(key)) {
      itemMap.set(key, { baseline: entry, latest: entry })
    } else {
      itemMap.get(key)!.latest = entry
    }
  }

  // Group by category
  const byCategory = new Map<string, Array<{ key: string; baseline: AchievementEntry; latest: AchievementEntry }>>()
  for (const [key, val] of itemMap) {
    const cat = val.baseline.category
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push({ key, ...val })
  }

  const watchedCategory = watch('category')

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Entry
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : itemMap.size === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No achievement entries yet"
          description="Add baseline measurements at intake, then track progress over time."
          action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add Entry</Button>}
        />
      ) : (
        <div className="space-y-6 max-w-2xl">
          {Array.from(byCategory.entries()).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {ACHIEVEMENT_CATEGORIES[cat as AchievementEntry['category']]}
              </p>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Item</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Baseline</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Current</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Change</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(({ key, baseline, latest }) => {
                      const delta = latest.scale - baseline.scale
                      return (
                        <tr key={key} className="border-b border-border last:border-0">
                          <td className="px-4 py-2.5 font-medium">{baseline.item}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <AchievementScaleDots scale={baseline.scale} />
                              <span className="text-xs text-muted-foreground">{baseline.scale}/5</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <AchievementScaleDots scale={latest.scale} baseline={baseline.scale} />
                              <span className="text-xs text-muted-foreground">{latest.scale}/5</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            {delta === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <span className={`text-xs font-medium ${delta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {delta > 0 ? '+' : ''}{delta}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteMutation.mutate(latest.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Diverging delta chart */}
          {itemMap.size > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Progress Overview (baseline → current)</p>
              <div className="space-y-1.5 max-w-lg">
                {Array.from(itemMap.entries()).map(([key, { baseline, latest }]) => {
                  const delta = latest.scale - baseline.scale
                  const barPct = Math.abs(delta) / 4 * 100
                  return (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      <span className="w-32 text-right text-muted-foreground truncate">{baseline.item}</span>
                      <div className="flex-1 h-4 flex items-center">
                        <div className="w-1/2 flex justify-end">
                          {delta < 0 && (
                            <div
                              className="h-3 rounded-l bg-red-400 dark:bg-red-600"
                              style={{ width: `${barPct}%` }}
                            />
                          )}
                        </div>
                        <div className="w-px h-4 bg-border flex-none" />
                        <div className="w-1/2">
                          {delta > 0 && (
                            <div
                              className="h-3 rounded-r bg-green-500 dark:bg-green-600"
                              style={{ width: `${barPct}%` }}
                            />
                          )}
                        </div>
                      </div>
                      <span className={`w-8 text-center font-medium ${delta > 0 ? 'text-green-600 dark:text-green-400' : delta < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                        {delta > 0 ? `+${delta}` : delta === 0 ? '0' : delta}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Achievement Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
            <FormField label="Category">
              <Select
                value={watchedCategory}
                onValueChange={(v) => setValue('category', v as AchievementEntry['category'])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACHIEVEMENT_CATEGORIES).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Item / Description *">
              <Input
                placeholder="e.g. Reading endurance, Headaches at school…"
                {...register('item', { required: true })}
              />
            </FormField>
            <FormField label="Scale (1 = Very Poor → 5 = Excellent)">
              <Select value={watch('scale')} onValueChange={(v) => setValue('scale', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <SelectItem key={v} value={String(v)}>{v} — {SCALE_LABELS[v]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Session Timer (Phase 4c) ─────────────────────────────────────────────────

function SessionTimer({ durationMin }: { durationMin: number }) {
  const totalSecs = durationMin * 60
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [pingEvery, setPingEvery] = useState(15)
  const [collapsed, setCollapsed] = useState(false)
  const lastPingRef = useRef(0)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setElapsed((e) => {
        const ne = e + 1
        const elapsedMin = Math.floor(ne / 60)
        if (elapsedMin > 0 && elapsedMin % pingEvery === 0 && elapsedMin !== lastPingRef.current) {
          lastPingRef.current = elapsedMin
          toast('Time to log an activity result?', { duration: 8000 })
        }
        return ne
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running, pingEvery])

  const remaining = totalSecs - elapsed
  const cappedRemaining = Math.max(0, remaining)
  const mins = Math.floor(cappedRemaining / 60)
  const secs = cappedRemaining % 60
  const overrun = elapsed > totalSecs

  function reset() {
    setRunning(false)
    setElapsed(0)
    lastPingRef.current = 0
  }

  const pct = Math.min(100, (elapsed / totalSecs) * 100)

  return (
    <div className="border border-border rounded-lg p-3 mb-4 bg-muted/20">
      <button
        type="button"
        className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="flex items-center gap-1.5"><Timer className="w-3.5 h-3.5" /> Session Timer</span>
        {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>

      {!collapsed && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-center">
              <span className={`text-3xl font-mono font-bold tabular-nums ${overrun ? 'text-destructive' : ''}`}>
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </span>
              <p className="text-xs text-muted-foreground">{overrun ? 'over time' : 'remaining'}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setRunning((r) => !r)}
              >
                {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {running ? 'Pause' : 'Start'}
              </Button>
              <Button type="button" size="icon" variant="ghost" onClick={reset} className="h-8 w-8">
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${overrun ? 'bg-destructive' : 'bg-primary'}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Ping every</span>
            <Select value={String(pingEvery)} onValueChange={(v) => setPingEvery(Number(v))}>
              <SelectTrigger className="h-6 w-20 text-xs px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 15, 20, 30].map((m) => (
                  <SelectItem key={m} value={String(m)}>{m} min</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>minutes</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Summary Composer (Phase 5a / 5b) ────────────────────────────────────────

function generateParentSummary(
  patient: Patient,
  appt: AppointmentWithPatient,
  freeText: string | null,
  inOfficeObs: string | null,
  activities: Array<{ name: string; level_label: string | null; observations: string | null; demo_video_url?: string | null }>,
  practiceName: string,
): string {
  const greeting = patient.guardian_name ? `Dear ${patient.guardian_name},` : 'Dear Parent/Guardian,'
  const name = patient.first_name
  const apptLabel = APPT_LABELS[appt.type] ?? appt.type
  const dateStr = format(parseISO(appt.starts_at), 'd MMMM yyyy')

  const lines: string[] = [
    greeting,
    '',
    `Thank you for bringing ${name} in for their ${apptLabel} appointment on ${dateStr}.`,
  ]

  if (freeText) {
    lines.push('', 'Clinical findings:', freeText)
  }

  if (activities.length > 0) {
    lines.push('', 'Today we worked on:')
    for (const a of activities) {
      let line = `• ${a.name}`
      if (a.level_label) line += ` (${a.level_label})`
      if (a.observations) line += ` — ${a.observations}`
      lines.push(line)
    }
  }

  if (inOfficeObs) {
    lines.push('', inOfficeObs)
  }

  const homeActivities = activities.filter((a) => (a as { demo_video_url?: string | null }).demo_video_url)
  if (homeActivities.length > 0) {
    lines.push('', 'Home exercise videos:')
    for (const a of homeActivities) {
      lines.push(`• ${a.name}: ${a.demo_video_url}`)
    }
  }

  lines.push('', 'If you have any questions, please don\'t hesitate to contact us.', '', `Warm regards,\n${practiceName}`)

  return lines.join('\n')
}

function generateReferrerSummary(
  patient: Patient,
  appt: AppointmentWithPatient,
  freeText: string | null,
  inOfficeObs: string | null,
  activities: Array<{ name: string; level_label: string | null; observations: string | null }>,
  practiceName: string,
  referrerName?: string,
): string {
  const greeting = referrerName ? `Dear ${referrerName},` : 'Dear Colleague,'
  const apptLabel = APPT_LABELS[appt.type] ?? appt.type
  const dateStr = format(parseISO(appt.starts_at), 'd MMMM yyyy')

  const lines: string[] = [
    greeting,
    '',
    `Re: ${patient.first_name} ${patient.last_name}`,
    '',
    `I am writing to update you on ${patient.first_name}'s progress following their ${apptLabel} appointment on ${dateStr}.`,
  ]

  if (freeText) {
    lines.push('', 'Clinical findings:', freeText)
  }

  if (activities.length > 0) {
    lines.push('', 'In-office activities performed:')
    for (const a of activities) {
      let line = `• ${a.name}`
      if (a.level_label) line += ` (${a.level_label})`
      if (a.observations) line += ` — ${a.observations}`
      lines.push(line)
    }
  }

  if (inOfficeObs) {
    lines.push('', inOfficeObs)
  }

  lines.push('', 'Please do not hesitate to contact our practice if you require further information.', '', `Yours sincerely,\n${practiceName}`)

  return lines.join('\n')
}

function SummaryComposerSection({
  appt,
  patient,
  notes,
  activities,
  practiceId,
  parentBody,
  referrerBody,
  onParentBodyChange,
  onReferrerBodyChange,
}: {
  appt: AppointmentWithPatient
  patient: Patient
  notes: { examNote: { free_text: string | null } | null; therapySession: { in_office_observations: string | null } | null } | undefined
  activities: Array<{ name: string; level_label: string | null; observations: string | null; demo_video_url?: string | null }>
  practiceId: string
  parentBody: string
  referrerBody: string
  onParentBodyChange: (v: string) => void
  onReferrerBodyChange: (v: string) => void
}) {
  const [activeTab, setActiveTab] = useState<'parent' | 'referrer'>('parent')

  const { data: practice } = useQuery({
    queryKey: qk.practice(practiceId),
    queryFn: () => fetchPractice(practiceId),
  })

  const { data: linkedReferrers = [] } = useQuery({
    queryKey: qk.patientReferrers(patient.id),
    queryFn: () => fetchPatientReferrers(patient.id),
  })

  const practiceName = practice?.name ?? 'Your Vision Therapy Practice'
  const guardianEmail = patient.guardian_email ?? patient.email ?? ''

  function generateParent() {
    const body = generateParentSummary(
      patient, appt,
      notes?.examNote?.free_text ?? null,
      notes?.therapySession?.in_office_observations ?? null,
      activities,
      practiceName,
    )
    onParentBodyChange(body)
    toast.success('Parent summary generated')
  }

  function generateReferrer(referrerName?: string) {
    const body = generateReferrerSummary(
      patient, appt,
      notes?.examNote?.free_text ?? null,
      notes?.therapySession?.in_office_observations ?? null,
      activities,
      practiceName,
      referrerName,
    )
    onReferrerBodyChange(body)
    toast.success('Referrer report generated')
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success('Copied to clipboard'),
      () => toast.error('Copy failed — select and copy manually'),
    )
  }

  function openMailto(to: string, subject: string, body: string) {
    const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(url, '_blank')
  }

  async function downloadSummaryPdf() {
    const apptLabel = APPT_LABELS[appt.type] ?? appt.type
    const dateStr = format(parseISO(appt.starts_at), 'd MMM yyyy')
    const homeActivities = activities.filter((a) => a.demo_video_url)
    const blob = await pdf(
      <SummaryPdf
        practiceName={practice?.name ?? 'Vision Therapy Practice'}
        patientName={`${patient.first_name} ${patient.last_name}`}
        appointmentDate={dateStr}
        appointmentType={apptLabel}
        summaryBody={parentBody}
        homeActivities={homeActivities}
      />
    ).toBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${patient.last_name}_${patient.first_name}_${dateStr.replace(/ /g, '_')}_summary.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const subjectParent = `${patient.first_name}'s Vision Therapy Update — ${format(parseISO(appt.starts_at), 'd MMM yyyy')}`
  const subjectReferrer = `Re: ${patient.first_name} ${patient.last_name} — Vision Therapy Update`

  return (
    <div className="border-t border-border pt-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Summaries</p>
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${activeTab === 'parent' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveTab('parent')}
        >
          Patient / Family
        </button>
        <button
          type="button"
          className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${activeTab === 'referrer' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveTab('referrer')}
        >
          Referrer Report
        </button>
      </div>

      {activeTab === 'parent' && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button type="button" size="sm" variant="outline" onClick={generateParent} className="h-7 text-xs">
              <Wand2 className="w-3 h-3 mr-1" /> Generate
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={!parentBody}
              onClick={() => copyToClipboard(parentBody)}
            >
              <Copy className="w-3 h-3 mr-1" /> Copy
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    disabled={!parentBody}
                    onClick={() => openMailto(guardianEmail, subjectParent, parentBody)}
                  >
                    <Mail className="w-3 h-3 mr-1" /> Open in Mail
                  </Button>
                </TooltipTrigger>
                {!guardianEmail && (
                  <TooltipContent>No email on file — add one on patient profile</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={!parentBody}
              onClick={downloadSummaryPdf}
            >
              <FileDown className="w-3 h-3 mr-1" /> Download PDF
            </Button>
          </div>
          <Textarea
            rows={5}
            placeholder="Click Generate to auto-fill, or type a plain-language summary for the family…"
            value={parentBody}
            onChange={(e) => onParentBodyChange(e.target.value)}
          />
        </div>
      )}

      {activeTab === 'referrer' && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {linkedReferrers.length > 0 ? (
              linkedReferrers.map((r) => (
                <Button
                  key={r.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => generateReferrer(r.name)}
                >
                  <Wand2 className="w-3 h-3 mr-1" /> Generate for {r.name}
                </Button>
              ))
            ) : (
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => generateReferrer()}>
                <Wand2 className="w-3 h-3 mr-1" /> Generate
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={!referrerBody}
              onClick={() => copyToClipboard(referrerBody)}
            >
              <Copy className="w-3 h-3 mr-1" /> Copy
            </Button>
          </div>
          {linkedReferrers.length > 0 && referrerBody && (
            <div className="flex gap-1.5 flex-wrap">
              {linkedReferrers.map((r) => r.email && (
                <Button
                  key={r.id}
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => openMailto(r.email!, subjectReferrer, referrerBody)}
                >
                  <Mail className="w-3 h-3 mr-1" /> Mail to {r.name}
                </Button>
              ))}
            </div>
          )}
          <Textarea
            rows={5}
            placeholder="Click Generate to auto-fill a professional-tone referrer report, or type manually…"
            value={referrerBody}
            onChange={(e) => onReferrerBodyChange(e.target.value)}
          />
          {linkedReferrers.length === 0 && (
            <p className="text-xs text-muted-foreground">Link referrers to this patient on the Overview tab to enable one-click mailto.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Intake link section (Phase 5c, OD side) ─────────────────────────────────

function IntakeLinkSection({ patient, practiceId }: { patient: Patient; practiceId: string }) {
  const queryClient = useQueryClient()
  const [sendOpen, setSendOpen] = useState(false)
  const [email, setEmail] = useState(patient.guardian_email ?? patient.email ?? '')
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [importDraftId, setImportDraftId] = useState<string | null>(null)

  const { data: intakeLinks = [] } = useQuery({
    queryKey: qk.intakeLinks(patient.id),
    queryFn: () => fetchIntakeLinks(patient.id),
  })

  const pendingLinks = intakeLinks.filter((l) => !l.used_at && new Date(l.expires_at) > new Date())
  const usedLinks = intakeLinks.filter((l) => !!l.used_at)

  const createLinkMutation = useMutation({
    mutationFn: async (recipientEmail: string) => {
      const token = crypto.randomUUID()
      const expiresAt = addDays(new Date(), 7).toISOString()
      const { error } = await supabase.from('intake_links').insert({
        practice_id: practiceId,
        patient_id: patient.id,
        token,
        email: recipientEmail,
        expires_at: expiresAt,
        used_at: null,
      })
      if (error) throw error
      return token
    },
    onSuccess: (token) => {
      queryClient.invalidateQueries({ queryKey: qk.intakeLinks(patient.id) })
      const link = `${window.location.origin}/intake/${token}`
      setGeneratedLink(link)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Fetch pending drafts for this patient's used intake links
  const usedLinkIds = usedLinks.map((l) => l.id)
  const [pendingDrafts, setPendingDrafts] = useState<Array<{
    id: string; intake_link_id: string; payload: Record<string, unknown>; submitted_at: string; reviewed_at: string | null
  }>>([])

  useEffect(() => {
    if (usedLinkIds.length === 0) return
    supabase
      .from('patient_intake_drafts')
      .select('*')
      .in('intake_link_id', usedLinkIds)
      .is('imported_patient_id', null)
      .then(({ data }) => { if (data) setPendingDrafts(data as typeof pendingDrafts) })
  }, [usedLinks.length])

  const importMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const draft = pendingDrafts.find((d) => d.id === draftId)
      if (!draft) throw new Error('Draft not found')
      const payload = draft.payload as Record<string, unknown>
      const { error: patErr } = await supabase.from('patients').update({
        first_name: (payload.first_name as string) || patient.first_name,
        last_name: (payload.last_name as string) || patient.last_name,
        dob: (payload.dob as string) || null,
        sex: (payload.sex as Patient['sex']) || null,
        email: (payload.email as string) || null,
        phone: (payload.phone as string) || null,
        guardian_name: (payload.guardian_name as string) || null,
        guardian_email: (payload.guardian_email as string) || null,
        guardian_phone: (payload.guardian_phone as string) || null,
        school: (payload.school as string) || null,
        grade: (payload.grade as string) || null,
        chief_complaint: (payload.chief_complaint as string) || null,
        referral_source: (payload.referral_source as string) || null,
        allied_health_notes: (payload.allied_health_notes as string) || null,
      }).eq('id', patient.id)
      if (patErr) throw patErr
      const { error: draftErr } = await supabase.from('patient_intake_drafts').update({
        imported_patient_id: patient.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', draftId)
      if (draftErr) throw draftErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.patient(patient.id) })
      setPendingDrafts((d) => d.filter((x) => x.id !== importDraftId))
      toast.success('Patient record updated from intake form')
      setImportDraftId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function copyLink(link: string) {
    navigator.clipboard.writeText(link).then(
      () => toast.success('Link copied'),
      () => toast.error('Copy failed'),
    )
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Intake Form</h3>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setGeneratedLink(null); setSendOpen(true) }}>
          <Link2 className="w-3 h-3 mr-1" /> Send Intake Link
        </Button>
      </div>

      {pendingLinks.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {pendingLinks.map((l) => {
            const link = `${window.location.origin}/intake/${l.token}`
            return (
              <div key={l.id} className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/30 text-xs">
                <span className="text-muted-foreground flex-1 truncate">{link}</span>
                <span className="text-muted-foreground flex-none">expires {format(parseISO(l.expires_at), 'd MMM')}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5 flex-none" onClick={() => copyLink(link)}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {pendingDrafts.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Pending intake submissions:</p>
          {pendingDrafts.map((draft) => {
            const p = draft.payload as Record<string, unknown>
            return (
              <div key={draft.id} className="border border-amber-200 dark:border-amber-800 rounded-lg p-3 bg-amber-50 dark:bg-amber-950/20 text-sm">
                <p className="font-medium text-xs mb-1">Submitted {format(parseISO(draft.submitted_at), 'd MMM yyyy, h:mm a')}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-2 mb-3">
                  {!!p.first_name && <span>Name: {String(p.first_name)} {String(p.last_name ?? '')}</span>}
                  {!!p.chief_complaint && <span>Complaint: {String(p.chief_complaint)}</span>}
                  {!!p.guardian_name && <span>Guardian: {String(p.guardian_name)}</span>}
                  {!!p.school && <span>School: {String(p.school)}</span>}
                </div>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setImportDraftId(draft.id)}
                >
                  <Check className="w-3 h-3 mr-1" /> Import to Patient Record
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {pendingLinks.length === 0 && pendingDrafts.length === 0 && (
        <p className="text-sm text-muted-foreground">No active intake links.</p>
      )}

      {/* Create link dialog */}
      <Dialog open={sendOpen} onOpenChange={(o) => { if (!o) { setSendOpen(false); setGeneratedLink(null) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Send Intake Form</DialogTitle>
          </DialogHeader>
          {generatedLink ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Share this link with the family. It expires in 7 days.</p>
              <div className="flex items-center gap-2 p-3 rounded-md border border-border bg-muted text-xs font-mono break-all">
                {generatedLink}
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => copyLink(generatedLink)}>
                  <Copy className="w-4 h-4 mr-1" /> Copy Link
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(`mailto:${encodeURIComponent(email)}?subject=Please complete your intake form&body=Please fill out your intake form here: ${encodeURIComponent(generatedLink)}`, '_blank')}
                >
                  <Mail className="w-4 h-4 mr-1" /> Open Mail
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <FormField label="Send to email">
                <Input
                  type="email"
                  placeholder="parent@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </FormField>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
                <Button
                  disabled={createLinkMutation.isPending || !email}
                  onClick={() => createLinkMutation.mutate(email)}
                >
                  Generate Link
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import confirm dialog */}
      <AlertDialog open={!!importDraftId} onOpenChange={(o) => !o && setImportDraftId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import intake data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite the patient's demographic and clinical fields with the data from the intake form. Existing data will be replaced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => importDraftId && importMutation.mutate(importDraftId)}>
              Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="appointments" className="gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Appointments
          </TabsTrigger>
          <TabsTrigger value="vt-program" className="gap-1.5">
            <ActivityIcon className="w-3.5 h-3.5" /> VT Program
          </TabsTrigger>
          <TabsTrigger value="rx" className="gap-1.5">
            <FlaskConical className="w-3.5 h-3.5" /> Rx
          </TabsTrigger>
          <TabsTrigger value="surveys" className="gap-1.5">
            <BarChart2 className="w-3.5 h-3.5" /> Surveys
          </TabsTrigger>
          <TabsTrigger value="achievement" className="gap-1.5">
            <Trophy className="w-3.5 h-3.5" /> Achievement
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab patient={patient} practiceId={practiceId ?? ''} />
        </TabsContent>

        <TabsContent value="appointments">
          <AppointmentsTab patientId={patient.id} practiceId={practiceId ?? ''} patient={patient} />
        </TabsContent>

        <TabsContent value="vt-program">
          <VtProgramTab patientId={patient.id} />
        </TabsContent>

        <TabsContent value="rx">
          <RxTab patientId={patient.id} />
        </TabsContent>

        <TabsContent value="surveys">
          <SurveysTab patientId={patient.id} />
        </TabsContent>

        <TabsContent value="achievement">
          <AchievementTab patientId={patient.id} />
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
