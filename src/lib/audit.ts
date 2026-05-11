import { supabase } from './supabase'

export async function writeAudit(
  practiceId: string,
  actorId: string,
  action: string,
  targetTable: string,
  targetId: string,
): Promise<void> {
  await supabase.from('audit_log').insert({
    practice_id: practiceId,
    actor_id: actorId,
    action,
    target_table: targetTable,
    target_id: targetId,
  })
  // Errors are intentionally swallowed — audit writes are best-effort
}
