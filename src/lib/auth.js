import { supabase, isSupabaseConfigured } from './supabase.js'

export function profileToUser(profile, authUser) {
  return {
    id: profile.id,
    nom: profile.nom || authUser?.email?.split('@')[0] || 'Utilisateur',
    role: profile.role || 'employe',
    email: authUser?.email || '',
    chantierIds: Array.isArray(profile.chantier_ids) ? profile.chantier_ids : [],
  }
}

export async function fetchProfile(userId) {
  if (!supabase) throw new Error('Supabase non configuré')

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nom, role, chantier_ids')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

export async function loadUserFromSession(session) {
  if (!session?.user) return null
  const profile = await fetchProfile(session.user.id)
  return profileToUser(profile, session.user)
}

export async function signInWithEmail(email, password) {
  if (!supabase) throw new Error('Supabase non configuré')

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error) throw error
  return loadUserFromSession(data.session)
}

export async function signOut() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  if (!supabase) return null
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export function authErrorMessage(error) {
  const msg = error?.message || ''
  if (msg.includes('Invalid login credentials')) {
    return 'Email ou mot de passe incorrect.'
  }
  if (msg.includes('Email not confirmed')) {
    return 'Confirmez votre email avant de vous connecter.'
  }
  if (msg.includes('profiles')) {
    return 'Profil utilisateur introuvable. Exécutez supabase/auth.sql et seed-demo-users.'
  }
  return msg || 'Erreur de connexion.'
}

export { isSupabaseConfigured }
