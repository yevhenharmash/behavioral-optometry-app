import { useQuery } from '@tanstack/react-query'
import { useAuth } from './auth'
import { supabase } from './supabase'

export function usePracticeId() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['practice-id', user?.id],
    enabled: !!user,
    staleTime: Infinity,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('practice_id')
        .eq('id', user!.id)
        .single()

      if (profile?.practice_id) return profile.practice_id as string

      const name = user!.user_metadata?.full_name
        ? `${user!.user_metadata.full_name}'s Practice`
        : 'My Practice'

      const { data: practice, error } = await supabase
        .from('practices')
        .insert({ name, owner_id: user!.id })
        .select('id')
        .single()

      if (error || !practice) throw error ?? new Error('Failed to create practice')

      await supabase.from('profiles').update({ practice_id: practice.id }).eq('id', user!.id)
      return practice.id as string
    },
  })
}
