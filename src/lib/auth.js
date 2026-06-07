import { supabase } from '../supabase.js'

/** Profil applicatif (compatible avec l'ancien objet COMPTES) */
export async function fetchAppUser(authUserId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nom, role, email, ch_ids, vierge, org_id, organizations ( plan_id )')
    .eq('id', authUserId)
    .single()

  if (error) throw error

  const planId = data.organizations?.plan_id || 'starter'

  return {
    id: data.id,
    nom: data.nom,
    role: data.role,
    email: data.email,
    chIds: (data.ch_ids || []).map(Number),
    vierge: data.vierge,
    orgId: data.org_id,
    planId,
  }
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error) throw error
  return fetchAppUser(data.user.id)
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSessionUser() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  try {
    return await fetchAppUser(session.user.id)
  } catch (e) {
    console.warn('[BuildEasy] Profil introuvable, déconnexion session:', e?.message)
    await supabase.auth.signOut().catch(() => {})
    return null
  }
}

export function onAuthChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (_event, session) => {
      if (session?.user) {
        try {
          callback(await fetchAppUser(session.user.id))
        } catch {
          callback(null)
        }
      } else {
        callback(null)
      }
    }
  )
  return () => subscription.unsubscribe()
}
