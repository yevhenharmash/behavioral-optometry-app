import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import {
  startOfWeek, addWeeks, subWeeks, eachDayOfInterval, addDays,
  format, isSameDay, isToday, parseISO,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { usePracticeId } from '@/lib/practice'
import { fetchAppointments, fetchPatients, qk, type AppointmentWithPatient } from '@/lib/queries'
import { supabase } from '@/lib/supabase'

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

type ApptForm = {
  patient_id: string
  date: string
  time: string
  duration_min: string
  type: string
  status: string
}

const EMPTY_APPT: ApptForm = {
  patient_id: '', date: '', time: '09:00',
  duration_min: '60', type: 'initial_eval', status: 'scheduled',
}

function apptToForm(a: AppointmentWithPatient): ApptForm {
  const d = parseISO(a.starts_at)
  return {
    patient_id: a.patient_id,
    date: format(d, 'yyyy-MM-dd'),
    time: format(d, 'HH:mm'),
    duration_min: String(a.duration_min),
    type: a.type,
    status: a.status,
  }
}

export function CalendarPage() {
  const { data: practiceId } = usePracticeId()
  const queryClient = useQueryClient()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [apptDialogOpen, setApptDialogOpen] = useState(false)
  const [editingAppt, setEditingAppt] = useState<AppointmentWithPatient | null>(null)

  const weekEnd = addDays(weekStart, 6)
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const from = weekStart.toISOString()
  const to = addWeeks(weekStart, 1).toISOString()

  const { data: appointments = [] } = useQuery({
    queryKey: qk.appointments(practiceId ?? '', from, to),
    enabled: !!practiceId,
    queryFn: () => fetchAppointments(practiceId!, from, to),
  })

  const { data: patients = [] } = useQuery({
    queryKey: qk.patients(practiceId ?? ''),
    enabled: !!practiceId,
    queryFn: () => fetchPatients(practiceId!),
  })

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<ApptForm>({
    defaultValues: EMPTY_APPT,
  })

  const saveMutation = useMutation({
    mutationFn: async ({ values, id }: { values: ApptForm; id?: string }) => {
      const starts_at = new Date(`${values.date}T${values.time}:00`).toISOString()
      const payload = {
        patient_id: values.patient_id,
        starts_at,
        duration_min: Number(values.duration_min),
        type: values.type as AppointmentWithPatient['type'],
        status: values.status as AppointmentWithPatient['status'],
      }
      if (id) {
        const { error } = await supabase.from('appointments').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('appointments').insert({ ...payload, practice_id: practiceId! })
        if (error) throw error
      }
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success(id ? 'Appointment updated' : 'Appointment created')
      setApptDialogOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('appointments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Appointment deleted')
      setApptDialogOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openAdd(day?: Date) {
    setEditingAppt(null)
    reset({ ...EMPTY_APPT, date: format(day ?? new Date(), 'yyyy-MM-dd') })
    setApptDialogOpen(true)
  }

  function openEdit(a: AppointmentWithPatient) {
    setEditingAppt(a)
    reset(apptToForm(a))
    setApptDialogOpen(true)
  }

  function onSubmit(values: ApptForm) {
    saveMutation.mutate({ values, id: editingAppt?.id })
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-none">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium w-44 text-center">
            {format(weekStart, 'd MMM')} – {format(weekEnd, 'd MMM yyyy')}
          </span>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            Today
          </Button>
        </div>
        <Button size="sm" onClick={() => openAdd()}>
          <Plus className="w-4 h-4 mr-1" /> New Appointment
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 min-w-[700px] divide-x divide-border h-full">
          {days.map((day) => {
            const dayAppts = appointments.filter((a) => isSameDay(parseISO(a.starts_at), day))
            const today = isToday(day)
            return (
              <div key={day.toISOString()} className="flex flex-col min-h-full">
                <div className={`px-3 py-2 border-b border-border text-center sticky top-0 z-10 bg-background ${today ? 'bg-primary/5' : ''}`}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{format(day, 'EEE')}</p>
                  <p className={`text-lg font-semibold mt-0.5 ${today ? 'text-primary' : 'text-foreground'}`}>
                    {format(day, 'd')}
                  </p>
                </div>
                <div className="flex-1 p-2 space-y-1.5">
                  {dayAppts.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => openEdit(a)}
                      className="w-full text-left rounded-md border border-border bg-card p-2 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    >
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <Clock className="w-3 h-3 flex-none" />
                        {format(parseISO(a.starts_at), 'h:mm a')}
                        <span className="opacity-50">· {a.duration_min}m</span>
                      </p>
                      <p className="text-sm font-medium leading-tight">
                        {a.patients.last_name}, {a.patients.first_name}
                      </p>
                      <span className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded font-medium ${APPT_COLORS[a.type]}`}>
                        {APPT_LABELS[a.type]}
                      </span>
                    </button>
                  ))}
                  <button
                    onClick={() => openAdd(day)}
                    className="w-full py-2 text-xs text-muted-foreground/40 hover:text-muted-foreground border border-dashed border-border/40 hover:border-border rounded-md transition-colors"
                  >
                    + add
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Dialog open={apptDialogOpen} onOpenChange={setApptDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAppt ? 'Edit Appointment' : 'New Appointment'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field label="Patient *">
              <Controller
                name="patient_id"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className={errors.patient_id ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Select patient…" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.last_name}, {p.first_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Date *">
                <Input type="date" {...register('date', { required: true })} className={errors.date ? 'border-destructive' : ''} />
              </Field>
              <Field label="Time *">
                <Input type="time" {...register('time', { required: true })} className={errors.time ? 'border-destructive' : ''} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Duration">
                <Controller
                  name="duration_min"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="45">45 min</SelectItem>
                        <SelectItem value="60">60 min</SelectItem>
                        <SelectItem value="90">90 min</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Type">
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(APPT_LABELS).map(([v, label]) => (
                          <SelectItem key={v} value={v}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <Field label="Status">
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="no_show">No Show</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <DialogFooter>
              {editingAppt && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:text-destructive mr-auto"
                  onClick={() => deleteMutation.mutate(editingAppt.id)}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setApptDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {editingAppt ? 'Save Changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
