import { supabase } from './supabase'
import type { Database } from '@/types/database.types'

type ActivityCategory = Database['public']['Tables']['activities']['Row']['category']

type SeedActivity = {
  key: string
  name: string
  category: ActivityCategory
  description: string
  levels: { label: string; description: string }[]
  default_frequency: string
}

const DEFAULT_ACTIVITIES: SeedActivity[] = [
  // ── Vergence ─────────────────────────────────────────────────────────────
  {
    key: 'brock_string',
    name: 'Brock String',
    category: 'vergence',
    description: 'Vergence awareness and control training using a string with coloured beads.',
    levels: [
      { label: 'Level 1', description: 'Single bead at near — awareness of physiological diplopia' },
      { label: 'Level 2', description: 'Two beads — convergence and divergence alternate' },
      { label: 'Level 3', description: 'Three beads — smooth vergence jumps across distances' },
    ],
    default_frequency: '10 min/day',
  },
  {
    key: 'pencil_pushups',
    name: 'Pencil Push-ups (HVAT)',
    category: 'vergence',
    description: 'Home-based near point convergence training using a pencil target.',
    levels: [
      { label: 'Level 1', description: 'Maintain single vision while approaching to 10 cm' },
      { label: 'Level 2', description: 'Approach to 5 cm with sustained fusion for 5 s' },
      { label: 'Level 3', description: 'Approach to nose; 3 sets of 20 repetitions' },
    ],
    default_frequency: '20 reps × 3 sets / day',
  },
  {
    key: 'prism_flippers',
    name: 'Prism Flippers',
    category: 'vergence',
    description: 'Alternating base-in / base-out prism flippers to develop vergence facility.',
    levels: [
      { label: '4 BO / 4 BI', description: 'Low demand — build awareness' },
      { label: '8 BO / 4 BI', description: 'Moderate demand' },
      { label: '12 BO / 6 BI', description: 'High demand — standard facility target' },
    ],
    default_frequency: '2 min (cycles per minute tracked)',
  },
  {
    key: 'computer_orthoptics_vergence',
    name: 'Computer Orthoptics — Vergence',
    category: 'vergence',
    description: 'Software-based vergence training (e.g. HTS, RoboVision, or similar).',
    levels: [
      { label: 'Step vergence', description: 'Jump from one fixation distance to another' },
      { label: 'Smooth vergence', description: 'Continuous slow vergence demand change' },
      { label: 'Random vergence', description: 'Mixed step and smooth demands' },
    ],
    default_frequency: '15 min/day',
  },

  // ── Accommodation ─────────────────────────────────────────────────────────
  {
    key: 'lens_flippers',
    name: 'Lens Flippers (±2.00)',
    category: 'accommodation',
    description: 'Accommodative facility training with plus/minus lens flippers at near.',
    levels: [
      { label: '±1.00', description: 'Low demand — introductory' },
      { label: '±2.00', description: 'Standard — target ≥8 cpm (children), ≥11 cpm (adults)' },
      { label: '±2.50', description: 'High demand' },
    ],
    default_frequency: '2 min / session (cycles per minute tracked)',
  },
  {
    key: 'hart_chart_rock',
    name: 'Hart Chart Rock',
    category: 'accommodation',
    description: 'Accommodative rock between a distance Hart Chart and near card to develop amplitude and facility.',
    levels: [
      { label: 'Monocular', description: 'Each eye separately' },
      { label: 'Binocular — same letter', description: 'Both eyes on the same letter size' },
      { label: 'Binocular — different', description: 'Distance and near charts differ in letter size' },
    ],
    default_frequency: '5 min/day each eye',
  },
  {
    key: 'minus_lens_training',
    name: 'Minus Lens Stimulation',
    category: 'accommodation',
    description: 'Sustained minus lens wear at near to stimulate accommodative amplitude.',
    levels: [
      { label: '-1.00', description: 'Introductory' },
      { label: '-2.00', description: 'Moderate' },
      { label: '-3.00', description: 'Advanced' },
    ],
    default_frequency: '10 min reading / day',
  },

  // ── Saccades ─────────────────────────────────────────────────────────────
  {
    key: 'saccade_training_pencils',
    name: 'Saccadic Training — Pencils',
    category: 'saccades',
    description: 'Rapid voluntary saccade practice between two fixation targets.',
    levels: [
      { label: 'Level 1', description: '20° amplitude — 40 cm distance' },
      { label: 'Level 2', description: '30° amplitude — varied head positions' },
      { label: 'Level 3', description: 'Add cognitive load (naming letters on targets)' },
    ],
    default_frequency: '2 min/day',
  },
  {
    key: 'macdonald_saccades',
    name: 'Macdonald Saccade Chart',
    category: 'saccades',
    description: 'Structured chart-based saccade training to improve accuracy and speed.',
    levels: [
      { label: 'Horizontal', description: 'Left–right large saccades' },
      { label: 'Vertical', description: 'Up–down saccades' },
      { label: 'Diagonal', description: 'Combined directions' },
    ],
    default_frequency: '1 row / day, timed',
  },
  {
    key: 'dem',
    name: 'DEM — Developmental Eye Movement',
    category: 'saccades',
    description: 'Standardised timed saccade test and training tool.',
    levels: [
      { label: 'Vertical test', description: 'Serial number reading — baseline speed' },
      { label: 'Horizontal test', description: 'Horizontal saccade reading — compare to vertical' },
      { label: 'Training', description: 'Repeated administration to build speed and accuracy' },
    ],
    default_frequency: '2× weekly (timed and scored)',
  },

  // ── Tracking ─────────────────────────────────────────────────────────────
  {
    key: 'marsden_ball',
    name: 'Marsden Ball',
    category: 'tracking',
    description: 'Pendulum ball used to train smooth pursuit and hand-eye coordination.',
    levels: [
      { label: 'Pursuit only', description: 'Follow the swinging ball with eyes only' },
      { label: 'Touch — dominant hand', description: 'Tap with finger as ball returns' },
      { label: 'Both hands / letters', description: 'Tap and call out letters on the ball' },
    ],
    default_frequency: '3 min/day',
  },
  {
    key: 'smooth_pursuit_pencil',
    name: 'Smooth Pursuit — Pencil',
    category: 'tracking',
    description: 'Clinician-guided smooth pursuit training with a pencil target.',
    levels: [
      { label: 'Horizontal', description: 'Slow horizontal pursuit, head still' },
      { label: 'Vertical & oblique', description: 'All directions, no head movement' },
      { label: 'Head movement added', description: 'VOR integration' },
    ],
    default_frequency: '2 min / session',
  },

  // ── Stereopsis ────────────────────────────────────────────────────────────
  {
    key: 'vectogram',
    name: 'Vectogram',
    category: 'stereopsis',
    description: 'Polarised stereoscopic targets used to train fusional vergence with real depth perception.',
    levels: [
      { label: 'Flat fusion', description: 'Fusion with no vergence demand change' },
      { label: 'Convergence demand', description: 'Base-out step vergence' },
      { label: 'Divergence demand', description: 'Base-in demand training' },
    ],
    default_frequency: '5 min/day',
  },
  {
    key: 'tranaglyph',
    name: 'Tranaglyph / Red-Green Stereogram',
    category: 'stereopsis',
    description: 'Anaglyphic targets viewed with red-green glasses to train binocular fusion.',
    levels: [
      { label: 'SILO awareness', description: 'Same image large object / small image out — diplopia awareness' },
      { label: 'Convergence series', description: 'Base-out demands increasing' },
      { label: 'Divergence series', description: 'Base-in demands increasing' },
    ],
    default_frequency: '5 min/day',
  },

  // ── Visual Motor ─────────────────────────────────────────────────────────
  {
    key: 'visual_motor_integration',
    name: 'Visual-Motor Integration (VMI)',
    category: 'visual_motor',
    description: 'Structured drawing and form copying activities to develop eye-hand coordination.',
    levels: [
      { label: 'Simple forms', description: 'Circles, lines, basic shapes' },
      { label: 'Complex designs', description: 'Geometric figures from Beery VMI' },
      { label: 'Timed tasks', description: 'Accuracy under time pressure' },
    ],
    default_frequency: '10 min/day',
  },
  {
    key: 'bilateral_coordination',
    name: 'Bilateral Coordination',
    category: 'visual_motor',
    description: 'Activities requiring simultaneous use of both hands guided by vision.',
    levels: [
      { label: 'Symmetrical patterns', description: 'Mirror drawing, clapping patterns' },
      { label: 'Reciprocal patterns', description: 'Alternating hand movements' },
      { label: 'Asymmetrical tasks', description: 'Different roles for each hand' },
    ],
    default_frequency: '5 min/day',
  },

  // ── Visual Processing ─────────────────────────────────────────────────────
  {
    key: 'visual_closure',
    name: 'Visual Closure',
    category: 'visual_processing',
    description: 'Identifying incomplete figures to strengthen visual completion ability.',
    levels: [
      { label: 'Level 1', description: 'Large objects with minimal degradation' },
      { label: 'Level 2', description: 'Smaller objects, more missing parts' },
      { label: 'Level 3', description: 'Abstract and embedded figures' },
    ],
    default_frequency: '5 min/day',
  },
  {
    key: 'figure_ground',
    name: 'Figure-Ground Discrimination',
    category: 'visual_processing',
    description: 'Identifying target shapes within complex, busy backgrounds.',
    levels: [
      { label: 'Simple background', description: 'Clear contrast, few distractors' },
      { label: 'Complex background', description: 'Many overlapping shapes' },
      { label: 'Timed', description: 'Speed and accuracy under time pressure' },
    ],
    default_frequency: '5 min/day',
  },
]

export async function seedActivitiesIfEmpty(): Promise<void> {
  const { count } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .is('practice_id', null)

  if ((count ?? 0) > 0) return

  const rows = DEFAULT_ACTIVITIES.map((a) => ({
    key: a.key,
    name: a.name,
    category: a.category,
    description: a.description,
    levels: a.levels,
    default_frequency: a.default_frequency,
    practice_id: null,
    instructions: null,
    demo_video_url: null,
    printable_pdf_url: null,
  }))

  await supabase.from('activities').insert(rows)
}
