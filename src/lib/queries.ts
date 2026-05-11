import { supabase } from './supabase'
import type { Database } from '@/types/database.types'

export type Patient = Database['public']['Tables']['patients']['Row']
export type Appointment = Database['public']['Tables']['appointments']['Row']
export type AppointmentWithPatient = Appointment & {
  patients: Pick<Patient, 'first_name' | 'last_name'>
}
export type VtProgram = Database['public']['Tables']['vt_programs']['Row']
export type Rx = Database['public']['Tables']['rxs']['Row']
export type ExamNote = Database['public']['Tables']['exam_notes']['Row']
export type TherapySession = Database['public']['Tables']['therapy_sessions']['Row']
export type Activity = Database['public']['Tables']['activities']['Row']
export type ActivityAssignment = Database['public']['Tables']['activity_assignments']['Row']
export type ActivityAssignmentWithActivity = ActivityAssignment & { activities: Pick<Activity, 'name' | 'category'> }
export type SurveyResponse = Database['public']['Tables']['survey_responses']['Row']

export const qk = {
  activities: (practiceId: string) => ['activities', practiceId] as const,
  sessionActivities: (therapySessionId: string) => ['session-activities', therapySessionId] as const,
  surveyResponses: (patientId: string) => ['survey-responses', patientId] as const,
  patients: (practiceId: string) => ['patients', practiceId] as const,
  patient: (id: string) => ['patient', id] as const,
  patientAppointments: (patientId: string) => ['patient-appointments', patientId] as const,
  vtProgram: (patientId: string) => ['vt-program', patientId] as const,
  rxs: (patientId: string) => ['rxs', patientId] as const,
  apptNotes: (apptId: string) => ['appt-notes', apptId] as const,
  appointments: (practiceId: string, from: string, to: string) =>
    ['appointments', practiceId, from, to] as const,
  todayStats: (practiceId: string, today: string) => ['today-stats', practiceId, today] as const,
}

export async function fetchPatients(practiceId: string): Promise<Patient[]> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('practice_id', practiceId)
    .eq('is_archived', false)
    .order('last_name')
  if (error) throw error
  return data
}

export async function fetchPatient(id: string): Promise<Patient> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function fetchPatientAppointments(patientId: string): Promise<AppointmentWithPatient[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*, patients(first_name, last_name)')
    .eq('patient_id', patientId)
    .order('starts_at', { ascending: false })
  if (error) throw error
  return data as unknown as AppointmentWithPatient[]
}

export async function fetchActiveVtProgram(patientId: string): Promise<VtProgram | null> {
  const { data, error } = await supabase
    .from('vt_programs')
    .select('*')
    .eq('patient_id', patientId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchVtPrograms(patientId: string): Promise<VtProgram[]> {
  const { data, error } = await supabase
    .from('vt_programs')
    .select('*')
    .eq('patient_id', patientId)
    .order('started_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchRxs(patientId: string): Promise<Rx[]> {
  const { data, error } = await supabase
    .from('rxs')
    .select('*')
    .eq('patient_id', patientId)
    .order('captured_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchApptNotes(apptId: string): Promise<{
  examNote: ExamNote | null
  therapySession: TherapySession | null
}> {
  const [{ data: examNote }, { data: therapySession }] = await Promise.all([
    supabase
      .from('exam_notes')
      .select('*')
      .eq('appointment_id', apptId)
      .eq('template_key', 'general')
      .maybeSingle(),
    supabase
      .from('therapy_sessions')
      .select('*')
      .eq('appointment_id', apptId)
      .maybeSingle(),
  ])
  return { examNote: examNote ?? null, therapySession: therapySession ?? null }
}

export async function fetchAppointments(
  practiceId: string,
  from: string,
  to: string,
): Promise<AppointmentWithPatient[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*, patients(first_name, last_name)')
    .eq('practice_id', practiceId)
    .gte('starts_at', from)
    .lt('starts_at', to)
    .order('starts_at')
  if (error) throw error
  return data as unknown as AppointmentWithPatient[]
}

export async function fetchActivities(practiceId: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .or(`practice_id.is.null,practice_id.eq.${practiceId}`)
    .order('category')
    .order('name')
  if (error) throw error
  return data
}

export async function fetchSessionActivities(therapySessionId: string): Promise<ActivityAssignmentWithActivity[]> {
  const { data, error } = await supabase
    .from('activity_assignments')
    .select('*, activities(name, category)')
    .eq('therapy_session_id', therapySessionId)
    .order('created_at')
  if (error) throw error
  return data as unknown as ActivityAssignmentWithActivity[]
}

export async function fetchSurveyResponses(patientId: string): Promise<SurveyResponse[]> {
  const { data, error } = await supabase
    .from('survey_responses')
    .select('*')
    .eq('patient_id', patientId)
    .order('captured_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchTodayStats(practiceId: string, todayStart: string, todayEnd: string) {
  const [{ count: apptCount }, { count: vtCount }] = await Promise.all([
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('practice_id', practiceId)
      .gte('starts_at', todayStart)
      .lt('starts_at', todayEnd)
      .neq('status', 'cancelled'),
    supabase
      .from('vt_programs')
      .select('*', { count: 'exact', head: true })
      .is('ended_at', null),
  ])
  return { apptCount: apptCount ?? 0, vtCount: vtCount ?? 0 }
}
