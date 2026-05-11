-- ============================================================
-- BehaveOpt schema
-- Run against a fresh Supabase project:
--   psql $DATABASE_URL -f supabase/schema.sql
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- Practices & Profiles
-- ============================================================

create table practices (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid references auth.users on delete set null,
  address     text,
  phone       text,
  email       text,
  created_at  timestamptz not null default now()
);

create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  practice_id  uuid references practices on delete cascade,
  role         text not null default 'od' check (role in ('od', 'therapist', 'staff')),
  full_name    text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- Auto-create profile on first sign-in (trigger set up in seed.sql)
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- Referrers
-- ============================================================

create table referrers (
  id           uuid primary key default gen_random_uuid(),
  practice_id  uuid not null references practices on delete cascade,
  name         text not null,
  role         text,   -- 'GP', 'OT', 'teacher', 'neurologist', etc.
  email        text,
  phone        text,
  notes        text,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- Patients
-- ============================================================

create table patients (
  id                  uuid primary key default gen_random_uuid(),
  practice_id         uuid not null references practices on delete cascade,
  first_name          text not null,
  last_name           text not null,
  dob                 date,
  sex                 text check (sex in ('male', 'female', 'other', 'prefer_not_to_say')),
  email               text,
  phone               text,
  guardian_name       text,
  guardian_email      text,
  guardian_phone      text,
  school              text,
  grade               text,
  referral_source     text,
  chief_complaint     text,
  allied_health_notes text,
  is_archived         boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table patient_referrers (
  patient_id   uuid not null references patients on delete cascade,
  referrer_id  uuid not null references referrers on delete cascade,
  primary key (patient_id, referrer_id)
);

-- ============================================================
-- Prescriptions (Rx history)
-- ============================================================

create table rxs (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references patients on delete cascade,
  captured_at  timestamptz not null default now(),
  -- OD (right eye)
  od_sph       numeric(5,2),
  od_cyl       numeric(5,2),
  od_axis      smallint,
  od_add       numeric(5,2),
  od_prism     numeric(5,2),
  od_base      text,
  -- OS (left eye)
  os_sph       numeric(5,2),
  os_cyl       numeric(5,2),
  os_axis      smallint,
  os_add       numeric(5,2),
  os_prism     numeric(5,2),
  os_base      text,
  -- PD
  pd_binocular numeric(5,1),
  pd_od        numeric(5,1),
  pd_os        numeric(5,1),
  notes        text
);

-- ============================================================
-- Appointments
-- ============================================================

create table appointments (
  id                       uuid primary key default gen_random_uuid(),
  practice_id              uuid not null references practices on delete cascade,
  patient_id               uuid not null references patients on delete cascade,
  starts_at                timestamptz not null,
  duration_min             smallint not null default 60,
  type                     text not null check (type in ('initial_eval', 'therapy_session', 'progress_check', 'consultation', 'follow_up')),
  status                   text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'no_show', 'cancelled')),
  summary_email_body       text,
  summary_referrer_body    text,
  summary_email_sent_at    timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ============================================================
-- Exam notes (JSON-driven templates)
-- ============================================================

create table exam_notes (
  id            uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments on delete cascade,
  -- known keys: 'initial_eval', 'progress_check', 'therapy_session'
  template_key  text not null,
  data          jsonb not null default '{}',
  free_text     text,
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- Activity library
-- ============================================================

create table activities (
  id                uuid primary key default gen_random_uuid(),
  -- null = built-in/system; non-null = practice-custom
  practice_id       uuid references practices on delete cascade,
  key               text not null unique,
  name              text not null,
  category          text not null check (category in (
    'vergence', 'accommodation', 'tracking', 'saccades',
    'stereopsis', 'visual_motor', 'visual_processing'
  )),
  description       text,
  instructions      text,
  levels            jsonb not null default '[]',  -- [{label, params}]
  default_frequency text,
  demo_video_url    text,
  printable_pdf_url text,
  created_at        timestamptz not null default now()
);

-- ============================================================
-- Therapy sessions & activity log
-- ============================================================

create table therapy_sessions (
  id                     uuid primary key default gen_random_uuid(),
  appointment_id         uuid not null references appointments on delete cascade,
  vt_program_id          uuid,  -- FK added after vt_programs table; needed for carry-over query
  in_office_observations text,
  created_at             timestamptz not null default now()
);

create table activity_assignments (
  id                uuid primary key default gen_random_uuid(),
  therapy_session_id uuid not null references therapy_sessions on delete cascade,
  activity_id        uuid not null references activities on delete restrict,
  mode               text not null check (mode in ('in_office', 'home')),
  level_label        text,
  duration_min       smallint,
  performance        smallint check (performance between 1 and 5),
  observations       text,
  widget_run_id      uuid,
  created_at         timestamptz not null default now()
);

-- ============================================================
-- VT Programs
-- ============================================================

create table program_templates (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique,
  name           text not null,
  diagnosis      text not null,
  duration_weeks smallint not null,
  goals          jsonb not null default '[]',
  weekly_plan    jsonb not null default '[]',  -- [{week, focus, activities:[activity_key…]}]
  created_at     timestamptz not null default now()
);

create table vt_programs (
  id                   uuid primary key default gen_random_uuid(),
  patient_id           uuid not null references patients on delete cascade,
  started_at           timestamptz not null default now(),
  ended_at             timestamptz,
  diagnosis            text not null,
  goals                jsonb not null default '[]',
  source_template_key  text references program_templates (key) on delete set null,
  created_at           timestamptz not null default now()
);

-- Back-fill the FK from therapy_sessions to vt_programs
alter table therapy_sessions
  add constraint therapy_sessions_vt_program_id_fkey
  foreign key (vt_program_id) references vt_programs (id) on delete set null;

-- ============================================================
-- Surveys
-- ============================================================

create table surveys (
  id       uuid primary key default gen_random_uuid(),
  key      text not null unique,
  name     text not null,
  items    jsonb not null default '[]',   -- [{key, prompt, scale_min, scale_max, scale_labels}]
  scoring  jsonb not null default '{}'   -- {method:'sum', cutoffs:[{value, label}]}
);

create table survey_responses (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references patients on delete cascade,
  survey_key   text not null references surveys (key) on delete restrict,
  captured_at  timestamptz not null default now(),
  answers      jsonb not null default '{}',   -- {item_key: int}
  score        integer,
  score_label  text
);

-- ============================================================
-- Achievement entries
-- ============================================================

create table achievement_entries (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references patients on delete cascade,
  vt_program_id  uuid references vt_programs on delete set null,
  captured_at    timestamptz not null default now(),
  category       text not null check (category in (
    'reading', 'academic', 'emotional', 'ocular_symptoms', 'localization', 'goals'
  )),
  item           text not null,
  scale          smallint not null check (scale between 1 and 5)
);

-- ============================================================
-- File attachments (schema present; upload UI disabled in v1)
-- ============================================================

create table attachments (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references patients on delete cascade,
  appointment_id uuid references appointments on delete set null,
  storage_path  text not null,
  filename      text not null,
  mime          text,
  size_bytes    integer,
  uploaded_at   timestamptz not null default now(),
  uploaded_by   uuid references auth.users on delete set null
);

-- ============================================================
-- Patient self-serve intake
-- ============================================================

create table intake_links (
  id           uuid primary key default gen_random_uuid(),
  practice_id  uuid not null references practices on delete cascade,
  patient_id   uuid references patients on delete set null,
  token        text not null unique default encode(gen_random_bytes(24), 'hex'),
  email        text not null,
  expires_at   timestamptz not null default (now() + interval '7 days'),
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);

create table patient_intake_drafts (
  id                   uuid primary key default gen_random_uuid(),
  intake_link_id       uuid not null references intake_links on delete cascade,
  payload              jsonb not null default '{}',
  submitted_at         timestamptz not null default now(),
  reviewed_at          timestamptz,
  imported_patient_id  uuid references patients on delete set null
);

-- ============================================================
-- Audit log
-- ============================================================

create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  practice_id   uuid references practices on delete set null,
  actor_id      uuid references auth.users on delete set null,
  action        text not null,
  target_table  text,
  target_id     uuid,
  at            timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index on patients (practice_id, last_name, first_name);
create index on appointments (practice_id, starts_at);
create index on appointments (patient_id, starts_at);
create index on therapy_sessions (vt_program_id);
create index on activity_assignments (therapy_session_id);
create index on survey_responses (patient_id, survey_key, captured_at);
create index on achievement_entries (patient_id, captured_at);
create index on intake_links (token);
create index on audit_log (practice_id, at desc);

-- ============================================================
-- Row Level Security
-- ============================================================

-- Helper: get practice_id of the current auth user
create or replace function current_practice_id()
returns uuid language sql stable security definer as $$
  select practice_id from profiles where id = auth.uid()
$$;

-- Enable RLS on every table
alter table practices             enable row level security;
alter table profiles              enable row level security;
alter table referrers             enable row level security;
alter table patients              enable row level security;
alter table patient_referrers     enable row level security;
alter table rxs                   enable row level security;
alter table appointments          enable row level security;
alter table exam_notes            enable row level security;
alter table activities            enable row level security;
alter table therapy_sessions      enable row level security;
alter table activity_assignments  enable row level security;
alter table program_templates     enable row level security;
alter table vt_programs           enable row level security;
alter table surveys               enable row level security;
alter table survey_responses      enable row level security;
alter table achievement_entries   enable row level security;
alter table attachments           enable row level security;
alter table intake_links          enable row level security;
alter table patient_intake_drafts enable row level security;
alter table audit_log             enable row level security;

-- Practices: owner or same-practice member
create policy "practice members" on practices
  for all using (id = current_practice_id() or owner_id = auth.uid());

-- Profiles: own row, or same practice
create policy "own profile" on profiles
  for all using (id = auth.uid() or practice_id = current_practice_id());

-- Generic practice-scoped tables
create policy "practice scope" on referrers
  for all using (practice_id = current_practice_id());

create policy "practice scope" on patients
  for all using (practice_id = current_practice_id());

create policy "practice scope" on appointments
  for all using (practice_id = current_practice_id());

create policy "practice scope" on intake_links
  for all using (practice_id = current_practice_id());

create policy "practice scope" on audit_log
  for all using (practice_id = current_practice_id());

-- Patient-joined tables (RLS via patient → practice)
create policy "via patient" on patient_referrers
  for all using (
    exists (select 1 from patients p where p.id = patient_id and p.practice_id = current_practice_id())
  );

create policy "via patient" on rxs
  for all using (
    exists (select 1 from patients p where p.id = patient_id and p.practice_id = current_practice_id())
  );

create policy "via patient" on vt_programs
  for all using (
    exists (select 1 from patients p where p.id = patient_id and p.practice_id = current_practice_id())
  );

create policy "via patient" on survey_responses
  for all using (
    exists (select 1 from patients p where p.id = patient_id and p.practice_id = current_practice_id())
  );

create policy "via patient" on achievement_entries
  for all using (
    exists (select 1 from patients p where p.id = patient_id and p.practice_id = current_practice_id())
  );

create policy "via patient" on attachments
  for all using (
    exists (select 1 from patients p where p.id = patient_id and p.practice_id = current_practice_id())
  );

create policy "via patient" on patient_intake_drafts
  for all using (
    exists (
      select 1 from intake_links il
      join patients p on p.id = il.patient_id
      where il.id = intake_link_id and p.practice_id = current_practice_id()
    )
  );

-- Appointment-joined tables
create policy "via appointment" on exam_notes
  for all using (
    exists (
      select 1 from appointments a where a.id = appointment_id and a.practice_id = current_practice_id()
    )
  );

create policy "via appointment" on therapy_sessions
  for all using (
    exists (
      select 1 from appointments a where a.id = appointment_id and a.practice_id = current_practice_id()
    )
  );

create policy "via therapy_session" on activity_assignments
  for all using (
    exists (
      select 1 from therapy_sessions ts
      join appointments a on a.id = ts.appointment_id
      where ts.id = therapy_session_id and a.practice_id = current_practice_id()
    )
  );

-- Activities: system-wide (practice_id IS NULL) or practice-specific
create policy "activities" on activities
  for all using (practice_id is null or practice_id = current_practice_id());

-- Surveys & program templates: read-only for all authenticated users (seeded data)
create policy "surveys read" on surveys
  for select using (auth.uid() is not null);

create policy "program_templates read" on program_templates
  for select using (auth.uid() is not null);

-- Public intake route: allow insert on patient_intake_drafts via valid token (no auth)
create policy "public intake submit" on patient_intake_drafts
  for insert with check (
    exists (
      select 1 from intake_links il
      where il.id = intake_link_id
        and il.used_at is null
        and il.expires_at > now()
    )
  );

create policy "public intake read own" on intake_links
  for select using (true);  -- token is secret; public route reads by token
