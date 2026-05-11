import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { format, parseISO } from 'date-fns'
import { CheckCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fetchIntakeDraftByToken } from '@/lib/queries'
import { supabase } from '@/lib/supabase'

type IntakeFormData = {
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
  // extra intake-only fields
  previous_eye_exams: string
  glasses_worn: string
  symptoms_description: string
  reading_difficulties: string
  headaches_frequency: string
}

const EMPTY_FORM: IntakeFormData = {
  first_name: '', last_name: '', dob: '', sex: '',
  email: '', phone: '', guardian_name: '', guardian_email: '', guardian_phone: '',
  school: '', grade: '', chief_complaint: '', referral_source: '', allied_health_notes: '',
  previous_eye_exams: '', glasses_worn: '', symptoms_description: '',
  reading_difficulties: '', headaches_frequency: '',
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold border-b border-border pb-2">{title}</h2>
      {children}
    </section>
  )
}

export function IntakePage() {
  const { token } = useParams<{ token: string }>()
  const [submitted, setSubmitted] = useState(false)

  const { data: linkData, isLoading, isError } = useQuery({
    queryKey: ['intake-link', token],
    queryFn: () => fetchIntakeDraftByToken(token!),
    enabled: !!token,
    retry: false,
  })

  const { register, handleSubmit, control, formState: { errors } } = useForm<IntakeFormData>({
    defaultValues: EMPTY_FORM,
  })

  const submitMutation = useMutation({
    mutationFn: async (values: IntakeFormData) => {
      if (!linkData?.link) throw new Error('Invalid link')
      const { error: draftErr } = await supabase.from('patient_intake_drafts').insert({
        intake_link_id: linkData.link.id,
        payload: values as unknown as import('@/types/database.types').Json,
        reviewed_at: null,
        imported_patient_id: null,
      })
      if (draftErr) throw draftErr
      const { error: linkErr } = await supabase
        .from('intake_links')
        .update({ used_at: new Date().toISOString() })
        .eq('id', linkData.link.id)
      if (linkErr) throw linkErr
    },
    onSuccess: () => setSubmitted(true),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  const isExpired = linkData && new Date(linkData.link.expires_at) < new Date()
  const isUsed = linkData?.link.used_at && !submitted

  if (isError || !linkData || isExpired || isUsed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold">Link not available</h1>
          <p className="text-sm text-muted-foreground">
            {isExpired
              ? 'This intake form link has expired. Please contact the practice for a new one.'
              : isUsed
              ? 'This intake form has already been submitted. Thank you!'
              : 'This link is invalid or has been removed. Please contact the practice.'}
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center space-y-3">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
          <h1 className="text-xl font-semibold">Thank you!</h1>
          <p className="text-sm text-muted-foreground">
            Your intake form has been submitted successfully. The practice team will review it before your appointment.
          </p>
          <p className="text-xs text-muted-foreground">You can close this page.</p>
        </div>
      </div>
    )
  }

  const expiresAt = format(parseISO(linkData.link.expires_at), 'd MMMM yyyy')

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Patient Intake Form</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Please complete this form before your appointment. Link expires {expiresAt}.
          </p>
        </div>

        <form onSubmit={handleSubmit((v) => submitMutation.mutate(v))} className="space-y-8">
          <Section title="Patient Information">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name *">
                <Input
                  placeholder="First name"
                  {...register('first_name', { required: true })}
                  className={errors.first_name ? 'border-destructive' : ''}
                />
              </Field>
              <Field label="Last Name *">
                <Input
                  placeholder="Last name"
                  {...register('last_name', { required: true })}
                  className={errors.last_name ? 'border-destructive' : ''}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email">
                <Input type="email" placeholder="patient@email.com" {...register('email')} />
              </Field>
              <Field label="Phone">
                <Input placeholder="0400 000 000" {...register('phone')} />
              </Field>
            </div>
          </Section>

          <Section title="Guardian / Parent (if applicable)">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Guardian Name">
                <Input placeholder="Parent/Guardian full name" {...register('guardian_name')} />
              </Field>
              <Field label="Guardian Phone">
                <Input placeholder="0400 000 000" {...register('guardian_phone')} />
              </Field>
            </div>
            <Field label="Guardian Email">
              <Input type="email" placeholder="parent@email.com" {...register('guardian_email')} />
            </Field>
          </Section>

          <Section title="School / Education">
            <div className="grid grid-cols-2 gap-4">
              <Field label="School Name">
                <Input placeholder="Primary / high school name" {...register('school')} />
              </Field>
              <Field label="Year / Grade">
                <Input placeholder="e.g. Year 4" {...register('grade')} />
              </Field>
            </div>
          </Section>

          <Section title="Reason for Visit">
            <Field label="Chief Complaint *" hint="What is the main reason for this appointment?">
              <Textarea
                rows={3}
                placeholder="e.g. Difficulties with reading, headaches when doing close work, eyes turning in…"
                {...register('chief_complaint', { required: true })}
                className={errors.chief_complaint ? 'border-destructive' : ''}
              />
            </Field>
            <Field label="Who referred you?">
              <Input placeholder="e.g. GP, optometrist, school, self-referral" {...register('referral_source')} />
            </Field>
          </Section>

          <Section title="Vision & Symptoms History">
            <Field label="Previous eye exams" hint="When was the last eye test? Any previous diagnoses?">
              <Textarea rows={2} placeholder="e.g. Last exam 12 months ago, no glasses prescribed" {...register('previous_eye_exams')} />
            </Field>
            <Field label="Do you / does the patient currently wear glasses or contact lenses?">
              <Controller
                name="glasses_worn"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="glasses_full_time">Glasses — full time</SelectItem>
                      <SelectItem value="glasses_part_time">Glasses — part time (reading etc.)</SelectItem>
                      <SelectItem value="contact_lenses">Contact lenses</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Describe the symptoms in detail">
              <Textarea
                rows={4}
                placeholder="e.g. Words blur after 10 minutes of reading, skips lines, double vision, rubs eyes frequently…"
                {...register('symptoms_description')}
              />
            </Field>
            <Field label="Reading difficulties" hint="How does reading affect daily life?">
              <Textarea
                rows={2}
                placeholder="e.g. Avoids reading, loses place, slow reader, re-reads sentences"
                {...register('reading_difficulties')}
              />
            </Field>
            <Field label="Headache frequency">
              <Controller
                name="headaches_frequency"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="rarely">Rarely (a few times per month)</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="daily">Daily or near-daily</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </Section>

          <Section title="Medical History">
            <Field label="Other relevant health information" hint="Allergies, medications, previous therapy (OT, speech, physio), ADHD, anxiety, concussion, etc.">
              <Textarea
                rows={4}
                placeholder="Please share anything you think is relevant to the assessment…"
                {...register('allied_health_notes')}
              />
            </Field>
          </Section>

          {submitMutation.isError && (
            <p className="text-sm text-destructive">
              Something went wrong — please try again or contact the practice directly.
            </p>
          )}

          <div className="flex justify-end pt-4 border-t border-border">
            <Button type="submit" size="lg" disabled={submitMutation.isPending}>
              {submitMutation.isPending ? 'Submitting…' : 'Submit Intake Form'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
