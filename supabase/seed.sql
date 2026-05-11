-- ============================================================
-- BehaveOpt seed data
-- Run AFTER schema.sql:
--   psql $DATABASE_URL -f supabase/seed.sql
-- ============================================================

-- ============================================================
-- Demo practice (replace owner_id with your auth.users.id after first login)
-- ============================================================

insert into practices (id, name, owner_id, address, phone, email)
values (
  '00000000-0000-0000-0000-000000000001',
  'Vision Development Clinic',
  null,
  '123 Optometry Lane, Melbourne VIC 3000',
  '+61 3 9000 0000',
  'admin@visiondevelopment.com.au'
) on conflict (id) do nothing;

-- ============================================================
-- Demo patient: Maya Thompson
-- ============================================================

insert into patients (
  id, practice_id, first_name, last_name, dob, sex,
  email, phone,
  guardian_name, guardian_email, guardian_phone,
  school, grade,
  referral_source, chief_complaint
) values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Maya', 'Thompson',
  '2015-03-14', 'female',
  null, null,
  'Sarah Thompson', 'sarah.thompson@email.com', '+61 412 000 000',
  'Riverside Primary', 'Grade 4',
  'Paediatrician referral',
  'Headaches after reading, avoids near work, losing place when reading'
) on conflict (id) do nothing;

-- Demo Rx for Maya
insert into rxs (patient_id, captured_at, od_sph, od_cyl, od_axis, os_sph, os_cyl, os_axis, pd_binocular)
values (
  '00000000-0000-0000-0000-000000000010',
  '2026-01-10 09:00:00+10',
  0.25, -0.50, 180, 0.00, -0.25, 175, 58.0
) on conflict do nothing;

-- Demo referrer
insert into referrers (id, practice_id, name, role, email)
values (
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000001',
  'Dr. James Park', 'Paediatrician', 'j.park@example.com'
) on conflict (id) do nothing;

insert into patient_referrers (patient_id, referrer_id)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000020'
) on conflict do nothing;

-- ============================================================
-- Activity library (~25 standard activities)
-- ============================================================

insert into activities (key, name, category, description, instructions, levels, default_frequency, demo_video_url) values

-- Vergence
('brock_string', 'Brock String', 'vergence',
 'Binocular vergence training using a string with coloured beads',
 'Hold one end of the string to your nose. Place beads at 10cm, 40cm, and 1m. Focus on each bead in turn — you should see an X at the bead you are looking at. Report any suppression.',
 '[{"label":"Near 10cm","params":{"distance_cm":10}},{"label":"Mid 40cm","params":{"distance_cm":40}},{"label":"Far 1m","params":{"distance_cm":100}}]',
 '5 min nightly', null),

('vectograms', 'Vectograms', 'vergence',
 'Polarised stereoscopic targets for base-in/base-out vergence training',
 'Using polarised glasses, view the vectogram target. Converge or diverge to maintain fusion as the panels are moved apart.',
 '[{"label":"BI Step 1","params":{"type":"BI","step":1}},{"label":"BO Step 1","params":{"type":"BO","step":1}},{"label":"BO Step 2","params":{"type":"BO","step":2}}]',
 '5 min nightly', null),

('aperture_rule', 'Aperture Rule', 'vergence',
 'Free-space convergence using aperture cards',
 'Hold the aperture rule at the prescribed distance. Look through the apertures at the target card. Maintain single, clear vision.',
 '[{"label":"Card 1 — convergence","params":{"card":1}},{"label":"Card 5","params":{"card":5}},{"label":"Card 10","params":{"card":10}}]',
 '5 min nightly', null),

('red_green_letters', 'Red/Green Letters', 'vergence',
 'Binocular antisuppression with red/green filters',
 'Wearing red/green glasses, read the letter chart. Report any letters that disappear (suppression). Alternate fixation between eyes.',
 '[{"label":"Distance 3m","params":{"distance_m":3}},{"label":"Near 40cm","params":{"distance_m":0.4}}]',
 '3 min nightly', null),

('yoked_prism_walking', 'Yoked Prism Walking', 'vergence',
 'Binasal or bitemporal yoked prisms worn during walking activities',
 'Wear yoked prism glasses as prescribed. Walk slowly around the room, focusing on objects at different distances. Report any discomfort or diplopia.',
 '[{"label":"2 BI yoked","params":{"prism":2,"type":"BI"}},{"label":"4 BI yoked","params":{"prism":4,"type":"BI"}}]',
 '5 min daily', null),

-- Accommodation
('plus_minus_flippers', 'Plus/Minus Flippers', 'accommodation',
 'Accommodative facility training with flipper lenses',
 'Hold the flipper lenses 40cm from the eyes. Flip to the plus side — clear the print, then flip to minus — clear the print. Count cycles per minute.',
 '[{"+1.00/-1.00":"±1.00","params":{"plus":1.00,"minus":1.00}},{"label":"±1.50","params":{"plus":1.50,"minus":1.50}},{"label":"±2.00","params":{"plus":2.00,"minus":2.00}}]',
 '2 min daily, both eyes then monocularly', null),

('near_far_rock', 'Near/Far Rock', 'accommodation',
 'Accommodative rock between near and far targets',
 'Hold a near card at 40cm. Look at a distant target (3–6m). Alternate fixation: clear near → clear far → count cycles. Should be clear and single throughout.',
 '[{"label":"No lens","params":{"lens":null}},{"label":"+1.00 near add","params":{"lens":1.00}}]',
 '3 min daily', null),

('marsden_ball', 'Marsden Ball', 'accommodation',
 'Hanging rotating ball for accommodative and oculomotor training',
 'Suspend the Marsden ball at eye level. As it swings/rotates, call out the letters. Can be done monocularly or binocularly.',
 '[{"label":"Binocular large print","params":{"eye":"both","size":"large"}},{"label":"Monocular small print","params":{"eye":"right","size":"small"}}]',
 '3 min daily', null),

-- Tracking / Oculomotor
('hart_chart', 'Hart Chart', 'tracking',
 'Saccadic fixation training between near and far Hart charts',
 'Place the far Hart chart on the wall at 3m. Hold the near Hart chart at 40cm. Read alternate lines from near to far. Record lines per minute.',
 '[{"label":"Bilateral","params":{"eye":"both"}},{"label":"Right monocular","params":{"eye":"right"}},{"label":"Left monocular","params":{"eye":"left"}}]',
 '2 min daily', null),

('saccade_fixation', 'Saccade Fixation — Two Targets', 'saccades',
 'Deliberate saccadic eye movement training between two fixed targets',
 'Tape two targets (X marks) on the wall 40cm apart at eye level. Fixate left target — then right — alternating. Keep head still. 20 saccades = one set.',
 '[{"label":"40cm apart at 1m","params":{"separation_cm":40,"distance_m":1}},{"label":"60cm apart at 1m","params":{"separation_cm":60,"distance_m":1}}]',
 '3 sets daily', null),

('dem_practice', 'DEM Practice Sheet', 'saccades',
 'Developmental Eye Movement test practice sheet for oculomotor training',
 'Using a DEM practice sheet, read each row of numbers without using a finger or ruler. Record time and errors.',
 '[{"label":"Horizontal rows","params":{"type":"horizontal"}},{"label":"Vertical subtest","params":{"type":"vertical"}}]',
 '1 sheet daily', null),

-- Stereopsis / Binocularity
('polaroid_dot_test', 'Polaroid Dot/Randot Stereo', 'stereopsis',
 'Graduated stereopsis evaluation and training with Randot or TNO targets',
 'Wearing polarised glasses, identify the floating dot or shape at each level. Record the lowest arc-second level achieved.',
 '[{"label":"400 arc-sec","params":{"arcsec":400}},{"label":"100 arc-sec","params":{"arcsec":100}},{"label":"40 arc-sec","params":{"arcsec":40}}]',
 '2 min sessions', null),

-- Visual Motor
('pegboard_rotator', 'Pegboard Rotator', 'visual_motor',
 'Eye-hand coordination training with rotating pegboard',
 'Insert pegs into the rotating pegboard as quickly and accurately as possible. Count insertions per 30 seconds.',
 '[{"label":"Dominant hand","params":{"hand":"dominant"}},{"label":"Non-dominant","params":{"hand":"non_dominant"}},{"label":"Both hands","params":{"hand":"both"}}]',
 '2 × 30 s sets daily', null),

('wolff_wand', 'Wolff Wand', 'visual_motor',
 'Visual-motor integration using a wand and target board',
 'Touch the lit target on the Wolff wand board as fast as possible using the pointer. Alternate binocular then monocular conditions.',
 '[{"label":"Binocular","params":{"eye":"both"}},{"label":"Monocular right","params":{"eye":"right"}}]',
 '1 min sets', null),

('chalkboard_circles', 'Chalkboard Circles', 'visual_motor',
 'Bilateral integration — drawing simultaneous circles on a chalkboard',
 'Stand at arm''s length from the board. Draw large circles simultaneously with both hands, starting at the top. Aim for smooth, synchronised movements.',
 '[{"label":"Outward circles","params":{"direction":"outward"}},{"label":"Inward circles","params":{"direction":"inward"}}]',
 '2 min daily', null),

-- Visual Processing
('visual_memory_sequence', 'Visual Memory Sequence', 'visual_processing',
 'Short-term visual memory training with digit/symbol sequences',
 'Show the sequence card for 3 seconds, then cover it. Write or say the sequence from memory. Increase length as accuracy improves.',
 '[{"label":"3-item","params":{"length":3}},{"label":"5-item","params":{"length":5}},{"label":"7-item","params":{"length":7}}]',
 '5 trials daily', null),

('visual_discrimination_cards', 'Visual Discrimination Cards', 'visual_processing',
 'Matching and differentiating similar visual forms',
 'Find the card that exactly matches the target. Work through the set as quickly as possible. Record time and errors per set.',
 '[{"label":"Basic shapes","params":{"level":"basic"}},{"label":"Letters/symbols","params":{"level":"letters"}}]',
 '1 set daily', null),

-- In-office widget-supported activities
('metronome_brock', 'Brock String with Metronome', 'vergence',
 'Brock string pacing with auditory metronome cue',
 'Set the in-app metronome. Shift gaze between beads in time with each beat. Report any breaks in fusion.',
 '[{"label":"60 BPM","params":{"bpm":60}},{"label":"80 BPM","params":{"bpm":80}},{"label":"100 BPM","params":{"bpm":100}}]',
 '3 min with metronome', null),

('tachistoscope_training', 'Tachistoscope — Visual Span', 'visual_processing',
 'Flash exposure training for visual information processing speed',
 'Fixate the centre of the screen. A digit/letter sequence will flash. Immediately report what you saw. Reduce exposure as accuracy improves.',
 '[{"label":"300ms","params":{"duration_ms":300}},{"label":"150ms","params":{"duration_ms":150}},{"label":"50ms","params":{"duration_ms":50}}]',
 '20 trials per session', null),

('saccade_dots', 'Saccade Dot Targeting', 'saccades',
 'Computerised saccade targeting — 2-point and 4-corner modes',
 'Using the in-app saccade widget, move your eyes to the dot as soon as it appears. Keep head still. Accuracy and latency are recorded.',
 '[{"label":"2-point","params":{"mode":"2pt"}},{"label":"4-corner","params":{"mode":"4corner"}}]',
 '3 min sessions', null),

('smooth_pursuits_screen', 'Smooth Pursuits — Screen', 'tracking',
 'Smooth pursuit training using on-screen animated path',
 'Follow the moving dot with your eyes — keep the dot in sharp focus throughout. The widget records fixation quality.',
 '[{"label":"Figure-8 slow","params":{"path":"figure8","speed":"slow"}},{"label":"Circle medium","params":{"path":"circle","speed":"medium"}},{"label":"Lazy-8 fast","params":{"path":"lazy8","speed":"fast"}}]',
 '2 min per path', null),

('hart_chart_digital', 'Hart Chart — Digital', 'tracking',
 'Digital Hart chart displayed on screen for near/far saccadic training',
 'Read the on-screen Hart chart at the prescribed distance. Alternate line by line between the near device and the far monitor.',
 '[{"label":"Near device 40cm","params":{"distance_cm":40}},{"label":"Wall screen 1.5m","params":{"distance_cm":150}}]',
 '2 min daily', null),

('reaction_time', 'Visual Reaction Time', 'visual_processing',
 'Tap-when-target-appears reaction time measurement',
 'Watch the screen. Tap/click as soon as the target appears. 20 trials — average reaction time is logged.',
 '[{"label":"20 trials","params":{"trials":20}}]',
 'End of session assessment', null),

('npc_push_up', 'NPC Push-up Pencil', 'vergence',
 'Near point of convergence training with pencil push-up exercise',
 'Hold the pencil at arm''s length. Slowly bring the pencil toward your nose. The moment you see double, note the break point, then push back until you regain single vision (recovery). Repeat.',
 '[{"label":"Pencil","params":{"target":"pencil"}},{"label":"Red-topped pen","params":{"target":"red_target"}}]',
 '10 reps twice daily', null),

('accommodative_rock_monocular', 'Monocular Accommodative Rock', 'accommodation',
 'Single-eye accommodative facility training',
 'Cover the non-practising eye. Hold flipper lenses at 40cm. Alternate plus and minus lenses, clearing the print each time. Count cycles per minute for each eye.',
 '[{"label":"Right eye ±1.00","params":{"eye":"right","power":1.00}},{"label":"Left eye ±1.00","params":{"eye":"left","power":1.00}},{"label":"Right eye ±2.00","params":{"eye":"right","power":2.00}}]',
 '2 min per eye daily', null)

on conflict (key) do nothing;

-- ============================================================
-- Surveys — CISS (Convergence Insufficiency Symptom Survey)
-- ============================================================

insert into surveys (key, name, items, scoring) values (
  'ciss',
  'Convergence Insufficiency Symptom Survey (CISS)',
  '[
    {"key":"eyestrain","prompt":"Do your eyes feel tired when reading or doing close work?","scale_min":0,"scale_max":4,"scale_labels":["Never","Infrequently","Sometimes","Fairly often","Always"]},
    {"key":"uncomfortable","prompt":"Do your eyes feel uncomfortable when reading or doing close work?","scale_min":0,"scale_max":4,"scale_labels":["Never","Infrequently","Sometimes","Fairly often","Always"]},
    {"key":"headaches","prompt":"Do you have headaches when reading or doing close work?","scale_min":0,"scale_max":4,"scale_labels":["Never","Infrequently","Sometimes","Fairly often","Always"]},
    {"key":"sleepy","prompt":"Do you feel sleepy when reading or doing close work?","scale_min":0,"scale_max":4,"scale_labels":["Never","Infrequently","Sometimes","Fairly often","Always"]},
    {"key":"concentration","prompt":"Do you lose concentration when reading or doing close work?","scale_min":0,"scale_max":4,"scale_labels":["Never","Infrequently","Sometimes","Fairly often","Always"]},
    {"key":"trouble_remembering","prompt":"Do you have trouble remembering what you have read?","scale_min":0,"scale_max":4,"scale_labels":["Never","Infrequently","Sometimes","Fairly often","Always"]},
    {"key":"double_vision","prompt":"Do you see double when reading or doing close work?","scale_min":0,"scale_max":4,"scale_labels":["Never","Infrequently","Sometimes","Fairly often","Always"]},
    {"key":"words_move","prompt":"Do words move, jump, swim or appear to float on the page when you are reading?","scale_min":0,"scale_max":4,"scale_labels":["Never","Infrequently","Sometimes","Fairly often","Always"]},
    {"key":"slow_reading","prompt":"Do you feel like you read slowly?","scale_min":0,"scale_max":4,"scale_labels":["Never","Infrequently","Sometimes","Fairly often","Always"]},
    {"key":"eye_pain","prompt":"Do your eyes ever hurt when reading or doing close work?","scale_min":0,"scale_max":4,"scale_labels":["Never","Infrequently","Sometimes","Fairly often","Always"]},
    {"key":"pulling","prompt":"Do your eyes feel sore when reading or doing close work?","scale_min":0,"scale_max":4,"scale_labels":["Never","Infrequently","Sometimes","Fairly often","Always"]},
    {"key":"blurry_near","prompt":"Do you notice the words blurring or coming in and out of focus when reading or doing close work?","scale_min":0,"scale_max":4,"scale_labels":["Never","Infrequently","Sometimes","Fairly often","Always"]},
    {"key":"lose_place","prompt":"Do you lose your place while reading?","scale_min":0,"scale_max":4,"scale_labels":["Never","Infrequently","Sometimes","Fairly often","Always"]},
    {"key":"reread","prompt":"Do you have to re-read the same line of words when reading?","scale_min":0,"scale_max":4,"scale_labels":["Never","Infrequently","Sometimes","Fairly often","Always"]},
    {"key":"avoids_reading","prompt":"Do you avoid reading or close work?","scale_min":0,"scale_max":4,"scale_labels":["Never","Infrequently","Sometimes","Fairly often","Always"]}
  ]',
  '{"method":"sum","max_score":60,"cutoffs":[{"value":21,"label":"Symptomatic for CI","above":true},{"value":20,"label":"Asymptomatic","above":false}]}'
) on conflict (key) do nothing;

-- ============================================================
-- Surveys — COVD-QOL (Quality of Life)
-- ============================================================

insert into surveys (key, name, items, scoring) values (
  'covd_qol',
  'COVD Quality of Life Survey',
  '[
    {"key":"headaches","prompt":"Headaches","scale_min":0,"scale_max":3,"scale_labels":["Never","Occasionally","Often","Always"]},
    {"key":"nausea","prompt":"Nausea","scale_min":0,"scale_max":3,"scale_labels":["Never","Occasionally","Often","Always"]},
    {"key":"dizziness","prompt":"Dizziness","scale_min":0,"scale_max":3,"scale_labels":["Never","Occasionally","Often","Always"]},
    {"key":"motion_sickness","prompt":"Motion sickness","scale_min":0,"scale_max":3,"scale_labels":["Never","Occasionally","Often","Always"]},
    {"key":"eye_strain","prompt":"Eye strain","scale_min":0,"scale_max":3,"scale_labels":["Never","Occasionally","Often","Always"]},
    {"key":"double_vision","prompt":"Double vision","scale_min":0,"scale_max":3,"scale_labels":["Never","Occasionally","Often","Always"]},
    {"key":"blurry_vision","prompt":"Blurry/fuzzy vision","scale_min":0,"scale_max":3,"scale_labels":["Never","Occasionally","Often","Always"]},
    {"key":"words_move","prompt":"Words move/jump","scale_min":0,"scale_max":3,"scale_labels":["Never","Occasionally","Often","Always"]},
    {"key":"sensitivity_light","prompt":"Sensitivity to light","scale_min":0,"scale_max":3,"scale_labels":["Never","Occasionally","Often","Always"]},
    {"key":"reading_avoidance","prompt":"Avoidance of reading","scale_min":0,"scale_max":3,"scale_labels":["Never","Occasionally","Often","Always"]},
    {"key":"comprehension","prompt":"Poor reading comprehension","scale_min":0,"scale_max":3,"scale_labels":["Never","Occasionally","Often","Always"]},
    {"key":"loses_place","prompt":"Loses place when reading","scale_min":0,"scale_max":3,"scale_labels":["Never","Occasionally","Often","Always"]},
    {"key":"omits_words","prompt":"Omits/substitutes words","scale_min":0,"scale_max":3,"scale_labels":["Never","Occasionally","Often","Always"]},
    {"key":"difficulty_copying","prompt":"Difficulty copying from board","scale_min":0,"scale_max":3,"scale_labels":["Never","Occasionally","Often","Always"]},
    {"key":"poor_attention","prompt":"Poor attention/concentration","scale_min":0,"scale_max":3,"scale_labels":["Never","Occasionally","Often","Always"]},
    {"key":"print_comes_goes","prompt":"Print comes in and out of focus","scale_min":0,"scale_max":3,"scale_labels":["Never","Occasionally","Often","Always"]},
    {"key":"poor_sports","prompt":"Poor sports performance","scale_min":0,"scale_max":3,"scale_labels":["Never","Occasionally","Often","Always"]},
    {"key":"poor_handwriting","prompt":"Poor handwriting","scale_min":0,"scale_max":3,"scale_labels":["Never","Occasionally","Often","Always"]},
    {"key":"clumsiness","prompt":"Clumsiness","scale_min":0,"scale_max":3,"scale_labels":["Never","Occasionally","Often","Always"]},
    {"key":"reverses_letters","prompt":"Reverses letters/numbers","scale_min":0,"scale_max":3,"scale_labels":["Never","Occasionally","Often","Always"]}
  ]',
  '{"method":"sum","max_score":60,"cutoffs":[{"value":20,"label":"Significant QOL impact","above":true},{"value":19,"label":"Mild or no impact","above":false}]}'
) on conflict (key) do nothing;

-- ============================================================
-- Program templates — 5 core diagnoses
-- ============================================================

insert into program_templates (key, name, diagnosis, duration_weeks, goals, weekly_plan) values

('convergence_insufficiency',
 'Convergence Insufficiency Program',
 'Convergence Insufficiency (CI)',
 12,
 '["Improve NPC to ≤5cm break/7cm recovery","PFV BO vergence ≥20Δ at near","CISS score <21","Comfortable sustained near work ≥30 min"]',
 '[
   {"week":1,"focus":"Baseline & monocular skills","activities":["npc_push_up","plus_minus_flippers","near_far_rock"]},
   {"week":2,"focus":"Introduce Brock string","activities":["brock_string","npc_push_up","plus_minus_flippers"]},
   {"week":3,"focus":"Anti-suppression","activities":["brock_string","red_green_letters","npc_push_up"]},
   {"week":4,"focus":"Vergence range expansion","activities":["brock_string","aperture_rule","red_green_letters"]},
   {"week":5,"focus":"Facility with vergence","activities":["vectograms","aperture_rule","brock_string"]},
   {"week":6,"focus":"Progress check & advance","activities":["vectograms","saccade_fixation","brock_string"]},
   {"week":7,"focus":"Accommodative-vergence","activities":["vectograms","plus_minus_flippers","metronome_brock"]},
   {"week":8,"focus":"Integrate binocular skills","activities":["vectograms","aperture_rule","hart_chart_digital"]},
   {"week":9,"focus":"Automatisation","activities":["vectograms","smooth_pursuits_screen","reaction_time"]},
   {"week":10,"focus":"Consolidation","activities":["vectograms","near_far_rock","brock_string"]},
   {"week":11,"focus":"Home programme independence","activities":["brock_string","npc_push_up","plus_minus_flippers"]},
   {"week":12,"focus":"Discharge assessment","activities":["npc_push_up","vectograms","reaction_time"]}
 ]'
),

('accommodative_dysfunction',
 'Accommodative Dysfunction Program',
 'Accommodative Infacility / Insufficiency',
 10,
 '["Monocular accommodative facility ≥12 cpm ±2.00","Binocular facility ≥8 cpm ±2.00","NRA/PRA within normal limits","Comfortable near work ≥30 min"]',
 '[
   {"week":1,"focus":"Monocular facility each eye","activities":["accommodative_rock_monocular","near_far_rock","plus_minus_flippers"]},
   {"week":2,"focus":"Build cycles — dominant eye","activities":["accommodative_rock_monocular","near_far_rock","plus_minus_flippers"]},
   {"week":3,"focus":"Non-dominant eye catch-up","activities":["accommodative_rock_monocular","plus_minus_flippers","marsden_ball"]},
   {"week":4,"focus":"Introduce binocular facility","activities":["plus_minus_flippers","near_far_rock","brock_string"]},
   {"week":5,"focus":"Increase lens power","activities":["plus_minus_flippers","vectograms","near_far_rock"]},
   {"week":6,"focus":"Progress check","activities":["plus_minus_flippers","near_far_rock","hart_chart"]},
   {"week":7,"focus":"Speed and automaticity","activities":["plus_minus_flippers","near_far_rock","saccade_fixation"]},
   {"week":8,"focus":"Integration with reading","activities":["plus_minus_flippers","hart_chart","dem_practice"]},
   {"week":9,"focus":"Generalisation tasks","activities":["plus_minus_flippers","near_far_rock","reaction_time"]},
   {"week":10,"focus":"Discharge assessment","activities":["plus_minus_flippers","near_far_rock","marsden_ball"]}
 ]'
),

('oculomotor_dysfunction',
 'Oculomotor Dysfunction Program',
 'Oculomotor Dysfunction (Tracking / Saccades)',
 10,
 '["DEM ratio <1.1 with <5 errors","Smooth pursuits grade 4/4","Saccadic fixation accurate and fast","Reading fluency improved by parental report"]',
 '[
   {"week":1,"focus":"Saccade baseline & gross training","activities":["saccade_fixation","dem_practice","hart_chart"]},
   {"week":2,"focus":"Refine saccade accuracy","activities":["saccade_dots","dem_practice","saccade_fixation"]},
   {"week":3,"focus":"Pursuits — gross","activities":["smooth_pursuits_screen","marsden_ball","saccade_fixation"]},
   {"week":4,"focus":"Pursuits — fine control","activities":["smooth_pursuits_screen","marsden_ball","dem_practice"]},
   {"week":5,"focus":"Integration saccades + pursuits","activities":["hart_chart_digital","saccade_dots","smooth_pursuits_screen"]},
   {"week":6,"focus":"Progress check","activities":["dem_practice","hart_chart","saccade_dots"]},
   {"week":7,"focus":"Speed drills","activities":["saccade_dots","dem_practice","reaction_time"]},
   {"week":8,"focus":"Reading integration","activities":["hart_chart_digital","dem_practice","smooth_pursuits_screen"]},
   {"week":9,"focus":"Automatisation","activities":["saccade_dots","smooth_pursuits_screen","reaction_time"]},
   {"week":10,"focus":"Discharge assessment","activities":["dem_practice","hart_chart_digital","reaction_time"]}
 ]'
),

('amblyopia',
 'Amblyopia Treatment Program',
 'Amblyopia (unilateral)',
 16,
 '["Improve amblyopic eye VA by ≥2 lines","Improve stereopsis to ≤100 arc-sec","Eliminate or reduce suppression","Stable binocularity"]',
 '[
   {"week":1,"focus":"Establish monocular baseline","activities":["accommodative_rock_monocular","marsden_ball","visual_discrimination_cards"]},
   {"week":2,"focus":"Forced fixation — amblyopic eye","activities":["accommodative_rock_monocular","hart_chart","marsden_ball"]},
   {"week":3,"focus":"Anti-suppression","activities":["red_green_letters","accommodative_rock_monocular","marsden_ball"]},
   {"week":4,"focus":"Fine motor amblyopic eye","activities":["pegboard_rotator","accommodative_rock_monocular","visual_memory_sequence"]},
   {"week":5,"focus":"Introduce binocular rivalry","activities":["red_green_letters","brock_string","accommodative_rock_monocular"]},
   {"week":6,"focus":"Stereo introduction","activities":["polaroid_dot_test","brock_string","red_green_letters"]},
   {"week":7,"focus":"Stereo grading","activities":["polaroid_dot_test","vectograms","brock_string"]},
   {"week":8,"focus":"Progress check","activities":["polaroid_dot_test","accommodative_rock_monocular","marsden_ball"]},
   {"week":9,"focus":"Binocular consolidation","activities":["vectograms","polaroid_dot_test","near_far_rock"]},
   {"week":10,"focus":"Fusion & vergence","activities":["aperture_rule","vectograms","polaroid_dot_test"]},
   {"week":11,"focus":"Anti-suppression advanced","activities":["red_green_letters","vectograms","saccade_dots"]},
   {"week":12,"focus":"Automaticity","activities":["vectograms","polaroid_dot_test","reaction_time"]},
   {"week":13,"focus":"Home plan independence","activities":["brock_string","plus_minus_flippers","red_green_letters"]},
   {"week":14,"focus":"Near tasks without patch","activities":["near_far_rock","vectograms","dem_practice"]},
   {"week":15,"focus":"Generalisation","activities":["smooth_pursuits_screen","vectograms","reaction_time"]},
   {"week":16,"focus":"Discharge assessment","activities":["polaroid_dot_test","vectograms","accommodative_rock_monocular"]}
 ]'
),

('post_concussion',
 'Post-Concussion Vision Syndrome Program',
 'Post-Concussion Vision Syndrome (PCVS)',
 14,
 '["Resolve photosensitivity and convergence insufficiency","CISS score <21","NPC ≤5cm","Return to sport/study tolerance ≥60 min","COVD-QOL score improved"]',
 '[
   {"week":1,"focus":"Symptom monitoring; gentle monocular","activities":["near_far_rock","accommodative_rock_monocular"]},
   {"week":2,"focus":"Low-demand saccades","activities":["saccade_fixation","near_far_rock","marsden_ball"]},
   {"week":3,"focus":"Introduce NPC training","activities":["npc_push_up","near_far_rock","saccade_fixation"]},
   {"week":4,"focus":"Anti-suppression gentle","activities":["brock_string","npc_push_up","near_far_rock"]},
   {"week":5,"focus":"Vestibular integration — yoked prism","activities":["yoked_prism_walking","brock_string","saccade_fixation"]},
   {"week":6,"focus":"Progress check; advance if symptom-free","activities":["brock_string","npc_push_up","smooth_pursuits_screen"]},
   {"week":7,"focus":"Accommodation facility","activities":["plus_minus_flippers","brock_string","near_far_rock"]},
   {"week":8,"focus":"Vergence range expansion","activities":["aperture_rule","vectograms","brock_string"]},
   {"week":9,"focus":"Screen tolerance grading","activities":["hart_chart_digital","saccade_dots","smooth_pursuits_screen"]},
   {"week":10,"focus":"Visual processing load","activities":["tachistoscope_training","visual_memory_sequence","saccade_dots"]},
   {"week":11,"focus":"Cognitive-visual dual task","activities":["dem_practice","tachistoscope_training","reaction_time"]},
   {"week":12,"focus":"Return-to-sport drills","activities":["reaction_time","saccade_dots","smooth_pursuits_screen"]},
   {"week":13,"focus":"Consolidation","activities":["vectograms","near_far_rock","brock_string"]},
   {"week":14,"focus":"Discharge assessment","activities":["npc_push_up","vectograms","reaction_time"]}
 ]'
)

on conflict (key) do nothing;
