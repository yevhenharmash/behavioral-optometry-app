# Behavioral Optometry Workflow Review

## Typical workflow (for reference)

1. **Referral / Patient Intake** → 2. **Initial Comprehensive Evaluation** → 3. **Diagnosis & Report** → 4. **VT Program Setup** → 5. **Weekly VT Sessions** → 6. **Progress Evaluations** (~every 8–12 sessions) → 7. **Discharge** → 8. **Follow-up**

---

## What's well covered

**Intake & Scheduling** ✓  
The token-based intake link is excellent — very aligned with how practices send forms before the first visit. Appointment types (`initial_eval`, `therapy_session`, `progress_check`, `follow_up`) map directly to the actual workflow stages.

**Referrer tracking** ✓  
Linking patients to referring practitioners and having referrer-specific summary fields on appointments is spot-on. Behavioral ODs are heavily dependent on school/pediatric referrals and they need to communicate back to them.

**VT Session documentation** ✓  
The activity log per therapy session (activity → level → duration → performance 1–5 → observations) is exactly how a VT therapist records sessions. The activity library covering vergence, accommodation, saccades, tracking, stereopsis, visual motor, and visual processing is comprehensive and correct.

**CISS Survey** ✓  
The Convergence Insufficiency Symptom Survey is the gold-standard outcome measure for the most common diagnosis — good call to build this in directly.

**Rx history** ✓  
Having OD/OS sphere/cylinder/axis/add/prism with multiple historical entries is essential, as lens prescriptions in VT (especially prism lenses and reading additions) change frequently.

---

## Notable gaps vs. the actual workflow

### 1. Initial Evaluation — no structured assessment recording

The `exam_notes` table exists in the schema but has no visible UI. A behavioral OD records specific measurements at the initial eval: NPC (near point of convergence), NPA (near point of accommodation), vergence ranges (BI/BO), accommodative amplitude, stereo acuity score, visual acuity, saccade/pursuit quality, etc. Right now the only option is a free-text "Notes" field on the appointment. Without structured exam findings, you can't track whether the patient improved from initial eval to progress check.

### 2. Progress evaluation flow is incomplete

A "Progress Check" appointment type exists but there's no mechanism to: (a) re-run key measurements, (b) compare current findings to the initial eval baseline, or (c) generate a progress report for the referrer. The referrer summary email field is available, but there's no template or data pull to populate it.

### 3. No home program printout

Activities can be logged as `home` mode but there's no way to generate a printable/shareable home program for parents. This is something behavioral OD practices do every single session — parents leave with a sheet showing what exercises to do, at what level, how often. This is a daily workflow gap.

### 4. VT program doesn't connect to session activities

When logging activities in a therapy session, there's no link back to "this is week 4 of the program, and here's what was prescribed for this week." The `program_templates` table has a `weekly_plan` JSON field in the schema, but the VT Program tab only shows diagnosis + goals. The weekly plan structure isn't surfaced in the UI.

### 5. No standardized tests beyond CISS

Behavioral ODs commonly administer: DEM (Developmental Eye Movement test), TVPS (Test of Visual Perceptual Skills), Beery VMI, and sometimes the NFI. Only CISS is implemented. The survey framework is flexible enough to support these — this is more of a "not yet populated" issue than a structural one.

### 6. Discharge is implicit, not explicit

Ending a VT program is a single button ("End Program") with no discharge workflow — no final evaluation summary, no discharge report template, no home maintenance program. Discharge reporting to the referrer is a significant part of the behavioral OD's workload.

### 7. Achievement tracking feels disconnected

The achievement entries (reading, academic, emotional, etc.) are meaningful to a behavioral OD and the data model is good. But there's no clear moment in the workflow where you'd fill these in — they feel orphaned from the appointment/session flow. Most ODs collect these as part of a progress check, not as a standalone action.

---

## Summary

The **core infrastructure** (intake, scheduling, Rx, VT session logging, referrers, CISS) is solid and clinically informed. The biggest workflow gaps are all around the **measurement and reporting layer**: structured exam findings at the initial eval, quantitative progress tracking, and the home program handout that parents take home every week.

**Highest-impact items to address:**
1. Structured exam findings form for initial evaluations and progress checks
2. Home program printout / PDF export for parents
3. Discharge workflow with referrer report template
