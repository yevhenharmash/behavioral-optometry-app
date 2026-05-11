import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { Plus, Pencil, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { usePracticeId } from '@/lib/practice'
import { fetchActivities, qk, type Activity } from '@/lib/queries'
import { seedActivitiesIfEmpty } from '@/lib/activities-seed'
import { supabase } from '@/lib/supabase'

const CATEGORY_LABELS: Record<string, string> = {
  vergence: 'Vergence',
  accommodation: 'Accommodation',
  tracking: 'Tracking',
  saccades: 'Saccades',
  stereopsis: 'Stereopsis',
  visual_motor: 'Visual Motor',
  visual_processing: 'Visual Processing',
}

const CATEGORY_COLORS: Record<string, string> = {
  vergence: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  accommodation: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  tracking: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  saccades: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  stereopsis: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  visual_motor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  visual_processing: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

type ActivityForm = {
  name: string
  category: string
  description: string
  levels: string
  default_frequency: string
}

const EMPTY_FORM: ActivityForm = {
  name: '', category: 'vergence', description: '', levels: '', default_frequency: '',
}

function activityToForm(a: Activity): ActivityForm {
  const levels = Array.isArray(a.levels)
    ? (a.levels as { label: string; description: string }[])
        .map((l) => `${l.label}: ${l.description}`)
        .join('\n')
    : ''
  return {
    name: a.name,
    category: a.category,
    description: a.description ?? '',
    levels,
    default_frequency: a.default_frequency ?? '',
  }
}

function parseLevels(raw: string): { label: string; description: string }[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) return { label: line, description: '' }
      return { label: line.slice(0, colonIdx).trim(), description: line.slice(colonIdx + 1).trim() }
    })
}

export function ActivitiesPage() {
  const { data: practiceId } = usePracticeId()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const { data: activities = [], isLoading } = useQuery({
    queryKey: qk.activities(practiceId ?? ''),
    enabled: !!practiceId,
    queryFn: () => fetchActivities(practiceId!),
  })

  useEffect(() => {
    if (practiceId) seedActivitiesIfEmpty().catch(() => {})
  }, [practiceId])

  const { register, handleSubmit, control, reset } = useForm<ActivityForm>({
    defaultValues: EMPTY_FORM,
  })

  const saveMutation = useMutation({
    mutationFn: async ({ values, id }: { values: ActivityForm; id?: string }) => {
      const payload = {
        name: values.name,
        category: values.category as Activity['category'],
        description: values.description.trim() || null,
        levels: parseLevels(values.levels),
        default_frequency: values.default_frequency.trim() || null,
      }
      if (id) {
        const { error } = await supabase.from('activities').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('activities').insert({
          ...payload,
          practice_id: practiceId!,
          key: values.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
          instructions: null,
          demo_video_url: null,
          printable_pdf_url: null,
        })
        if (error) throw error
      }
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: qk.activities(practiceId!) })
      toast.success(id ? 'Activity updated' : 'Activity added')
      setDialogOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openAdd() {
    setEditingActivity(null)
    reset(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(a: Activity) {
    if (!a.practice_id) return // system activities are read-only
    setEditingActivity(a)
    reset(activityToForm(a))
    setDialogOpen(true)
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Group by category
  const grouped = activities.reduce<Record<string, Activity[]>>((acc, a) => {
    ;(acc[a.category] ??= []).push(a)
    return acc
  }, {})

  const categoryOrder = Object.keys(CATEGORY_LABELS)

  return (
    <div className="flex-1 p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Activities</h1>
          <p className="text-sm text-muted-foreground mt-0.5">VT activity library — system activities + your custom ones</p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-1" /> Add Activity
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activities yet.</p>
      ) : (
        <div className="space-y-6 max-w-3xl">
          {categoryOrder.map((cat) => {
            const group = grouped[cat]
            if (!group?.length) return null
            return (
              <section key={cat}>
                <h2 className="flex items-center gap-2 text-sm font-semibold mb-3">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium ${CATEGORY_COLORS[cat]}`}>
                    {CATEGORY_LABELS[cat]}
                  </span>
                  <span className="text-muted-foreground font-normal">{group.length} activities</span>
                </h2>
                <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                  {group.map((a) => {
                    const levels = Array.isArray(a.levels)
                      ? (a.levels as { label: string; description: string }[])
                      : []
                    const expanded = expandedIds.has(a.id)
                    return (
                      <div key={a.id} className="bg-card">
                        <button
                          className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors flex items-center gap-3"
                          onClick={() => toggleExpand(a.id)}
                        >
                          {expanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-none" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-none" />
                          )}
                          <span className="text-sm font-medium flex-1">{a.name}</span>
                          {a.default_frequency && (
                            <span className="text-xs text-muted-foreground hidden sm:block">{a.default_frequency}</span>
                          )}
                          {!a.practice_id && (
                            <Badge variant="outline" className="text-xs ml-2">System</Badge>
                          )}
                          {a.practice_id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 ml-1"
                              onClick={(e) => { e.stopPropagation(); openEdit(a) }}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                          )}
                        </button>

                        {expanded && (
                          <div className="px-10 pb-4 space-y-3">
                            {a.description && (
                              <p className="text-sm text-muted-foreground">{a.description}</p>
                            )}
                            {levels.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Levels</p>
                                <ul className="space-y-1">
                                  {levels.map((l, i) => (
                                    <li key={i} className="text-sm flex gap-2">
                                      <span className="font-medium min-w-[80px]">{l.label}</span>
                                      <span className="text-muted-foreground">{l.description}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingActivity ? 'Edit Activity' : 'Add Activity'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((values) => saveMutation.mutate({ values, id: editingActivity?.id }))}>
            <ScrollArea className="h-[55vh] pr-4">
              <div className="space-y-4 pb-2">
                <FormField label="Name *">
                  <Input {...register('name', { required: true })} placeholder="e.g. Brock String" />
                </FormField>
                <FormField label="Category *">
                  <Controller
                    name="category"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
                <FormField label="Description">
                  <Textarea rows={2} {...register('description')} placeholder="Brief description of the activity…" />
                </FormField>
                <FormField label="Levels (one per line: Label: Description)">
                  <Textarea
                    rows={4}
                    {...register('levels')}
                    placeholder={'Level 1: Basic awareness\nLevel 2: Add complexity\nLevel 3: Timed / advanced'}
                  />
                </FormField>
                <FormField label="Default Frequency">
                  <Input {...register('default_frequency')} placeholder="e.g. 10 min/day" />
                </FormField>
              </div>
            </ScrollArea>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {editingActivity ? 'Save Changes' : 'Add Activity'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  )
}
