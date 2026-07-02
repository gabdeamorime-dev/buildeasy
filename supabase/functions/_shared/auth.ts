import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2'

export type AdminProfile = {
  org_id: string
  email: string | null
  role: string
}

export async function requireAdminUser(req: Request): Promise<
  { user: User; profile: AdminProfile; supabase: SupabaseClient } | Response
> {
  const auth = req.headers.get('Authorization')
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Non authentifié' }), { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Session invalide' }), { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id, email, role')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) {
    return new Response(JSON.stringify({ error: 'Organisation introuvable' }), { status: 400 })
  }

  if (profile.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Réservé au gérant' }), { status: 403 })
  }

  return { user, profile: profile as AdminProfile, supabase }
}
