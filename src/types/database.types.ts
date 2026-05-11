// Auto-generate this file with:
//   npx supabase gen types typescript --project-id <your-project-id> > src/types/database.types.ts
//
// This stub satisfies the TypeScript compiler until the real types are generated.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      practices: {
        Row: {
          id: string
          name: string
          owner_id: string | null
          address: string | null
          phone: string | null
          email: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['practices']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['practices']['Insert']>
      }
      profiles: {
        Row: {
          id: string
          practice_id: string | null
          role: 'od' | 'therapist' | 'staff'
          full_name: string | null
          avatar_url: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'> & { created_at?: string }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      patients: {
        Row: {
          id: string
          practice_id: string
          first_name: string
          last_name: string
          dob: string | null
          sex: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null
          email: string | null
          phone: string | null
          guardian_name: string | null
          guardian_email: string | null
          guardian_phone: string | null
          school: string | null
          grade: string | null
          referral_source: string | null
          chief_complaint: string | null
          allied_health_notes: string | null
          is_archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['patients']['Row'], 'id' | 'created_at' | 'updated_at' | 'is_archived'> & { id?: string; created_at?: string; updated_at?: string; is_archived?: boolean }
        Update: Partial<Database['public']['Tables']['patients']['Insert']>
      }
      referrers: {
        Row: {
          id: string
          practice_id: string
          name: string
          role: string | null
          email: string | null
          phone: string | null
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['referrers']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['referrers']['Insert']>
      }
      patient_referrers: {
        Row: { patient_id: string; referrer_id: string }
        Insert: Database['public']['Tables']['patient_referrers']['Row']
        Update: Partial<Database['public']['Tables']['patient_referrers']['Row']>
      }
      rxs: {
        Row: {
          id: string
          patient_id: string
          captured_at: string
          od_sph: number | null; od_cyl: number | null; od_axis: number | null; od_add: number | null; od_prism: number | null; od_base: string | null
          os_sph: number | null; os_cyl: number | null; os_axis: number | null; os_add: number | null; os_prism: number | null; os_base: string | null
          pd_binocular: number | null; pd_od: number | null; pd_os: number | null
          notes: string | null
        }
        Insert: Omit<Database['public']['Tables']['rxs']['Row'], 'id' | 'captured_at'> & { id?: string; captured_at?: string }
        Update: Partial<Database['public']['Tables']['rxs']['Insert']>
      }
      appointments: {
        Row: {
          id: string
          practice_id: string
          patient_id: string
          starts_at: string
          duration_min: number
          type: 'initial_eval' | 'therapy_session' | 'progress_check' | 'consultation' | 'follow_up'
          status: 'scheduled' | 'in_progress' | 'completed' | 'no_show' | 'cancelled'
          summary_email_body: string | null
          summary_referrer_body: string | null
          summary_email_sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['appointments']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Database['public']['Tables']['appointments']['Insert']>
      }
      exam_notes: {
        Row: {
          id: string
          appointment_id: string
          template_key: string
          data: Json
          free_text: string | null
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['exam_notes']['Row'], 'id' | 'updated_at'> & { id?: string; updated_at?: string }
        Update: Partial<Database['public']['Tables']['exam_notes']['Insert']>
      }
      activities: {
        Row: {
          id: string
          practice_id: string | null
          key: string
          name: string
          category: 'vergence' | 'accommodation' | 'tracking' | 'saccades' | 'stereopsis' | 'visual_motor' | 'visual_processing'
          description: string | null
          instructions: string | null
          levels: Json
          default_frequency: string | null
          demo_video_url: string | null
          printable_pdf_url: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['activities']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['activities']['Insert']>
      }
      therapy_sessions: {
        Row: {
          id: string
          appointment_id: string
          vt_program_id: string | null
          in_office_observations: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['therapy_sessions']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['therapy_sessions']['Insert']>
      }
      activity_assignments: {
        Row: {
          id: string
          therapy_session_id: string
          activity_id: string
          mode: 'in_office' | 'home'
          level_label: string | null
          duration_min: number | null
          performance: number | null
          observations: string | null
          widget_run_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['activity_assignments']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['activity_assignments']['Insert']>
      }
      program_templates: {
        Row: {
          id: string
          key: string
          name: string
          diagnosis: string
          duration_weeks: number
          goals: Json
          weekly_plan: Json
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['program_templates']['Row'], 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['program_templates']['Insert']>
      }
      vt_programs: {
        Row: {
          id: string
          patient_id: string
          started_at: string
          ended_at: string | null
          diagnosis: string
          goals: Json
          source_template_key: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['vt_programs']['Row'], 'id' | 'created_at' | 'started_at'> & { id?: string; created_at?: string; started_at?: string }
        Update: Partial<Database['public']['Tables']['vt_programs']['Insert']>
      }
      surveys: {
        Row: {
          id: string
          key: string
          name: string
          items: Json
          scoring: Json
        }
        Insert: Omit<Database['public']['Tables']['surveys']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['surveys']['Insert']>
      }
      survey_responses: {
        Row: {
          id: string
          patient_id: string
          survey_key: string
          captured_at: string
          answers: Json
          score: number | null
          score_label: string | null
        }
        Insert: Omit<Database['public']['Tables']['survey_responses']['Row'], 'id' | 'captured_at'> & { id?: string; captured_at?: string }
        Update: Partial<Database['public']['Tables']['survey_responses']['Insert']>
      }
      achievement_entries: {
        Row: {
          id: string
          patient_id: string
          vt_program_id: string | null
          captured_at: string
          category: 'reading' | 'academic' | 'emotional' | 'ocular_symptoms' | 'localization' | 'goals'
          item: string
          scale: number
        }
        Insert: Omit<Database['public']['Tables']['achievement_entries']['Row'], 'id' | 'captured_at'> & { id?: string; captured_at?: string }
        Update: Partial<Database['public']['Tables']['achievement_entries']['Insert']>
      }
      attachments: {
        Row: {
          id: string
          patient_id: string
          appointment_id: string | null
          storage_path: string
          filename: string
          mime: string | null
          size_bytes: number | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['attachments']['Row'], 'id' | 'uploaded_at'> & { id?: string; uploaded_at?: string }
        Update: Partial<Database['public']['Tables']['attachments']['Insert']>
      }
      intake_links: {
        Row: {
          id: string
          practice_id: string
          patient_id: string | null
          token: string
          email: string
          expires_at: string
          used_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['intake_links']['Row'], 'id' | 'token' | 'created_at'> & { id?: string; token?: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['intake_links']['Insert']>
      }
      patient_intake_drafts: {
        Row: {
          id: string
          intake_link_id: string
          payload: Json
          submitted_at: string
          reviewed_at: string | null
          imported_patient_id: string | null
        }
        Insert: Omit<Database['public']['Tables']['patient_intake_drafts']['Row'], 'id' | 'submitted_at'> & { id?: string; submitted_at?: string }
        Update: Partial<Database['public']['Tables']['patient_intake_drafts']['Insert']>
      }
      audit_log: {
        Row: {
          id: string
          practice_id: string | null
          actor_id: string | null
          action: string
          target_table: string | null
          target_id: string | null
          at: string
        }
        Insert: Omit<Database['public']['Tables']['audit_log']['Row'], 'id' | 'at'> & { id?: string; at?: string }
        Update: Partial<Database['public']['Tables']['audit_log']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: {
      current_practice_id: { Args: Record<string, never>; Returns: string }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
