import { supabase, isSupabaseConfigured } from '../supabase.js'
import { fetchOrgPlan } from './db.js'

function sb() {
  if (!supabase) throw new Error('Supabase non configuré')
  return supabase
}

function chIdsFromProfile(profile, authUser) {
  const meta = authUser.app_metadata ?? {}
  const umeta = authUser.user_metadata ?? {}
  const raw =
    profile?.ch_ids ??
    profile?.chantier_ids ??
    umeta.ch_ids ??
    umeta.chantier_ids ??
    meta.ch_ids ??
    meta.chantier_ids ??
    []
  return (Array.isArray(raw) ? raw : []).map(Number).filter((n) => !Number.isNaN(n))
}

async function ensureSignupComplete(authUser) {
  const umeta = authUser.user_metadata ?? {}
  if (umeta.signup !== 'true' && umeta.signup !== true) return

  const { data: profile } = await sb()
    .from('profiles')
    .select('org_id')
    .eq('id', authUser.id)
    .maybeSingle()

  if (profile?.org_id) return

  const { error } = await sb().rpc('finish_signup', {
    entreprise_nom: umeta.entreprise || umeta.entreprise_nom || 'Mon entreprise',
    nom_utilisateur: umeta.nom || '',
  })
  if (error) console.warn('[BuildEasy] finish_signup:', error.message)
}

/** Profil applicatif (compatible avec l'ancien objet COMPTES) */
export async function fetchAppUser(authUserId) {
  const { data: authData, error: authErr } = await sb().auth.getUser()
  if (authErr) throw authErr
  const authUser = authData?.user
  if (!authUser || authUser.id !== authUserId) throw new Error('Session invalide')

  await ensureSignupComplete(authUser)

  const { data: profile } = await sb()
    .from('profiles')
    .select('id, nom, role, email, chantier_ids, vierge, org_id, plan_id')
    .eq('id', authUserId)
    .maybeSingle()

  const meta = authUser.app_metadata ?? {}
  const umeta = authUser.user_metadata ?? {}

  const orgId = profile?.org_id ?? umeta.org_id ?? null
  let planId = profile?.plan_id ?? umeta.planId ?? meta.planId ?? 'starter'
  if (orgId) {
    try { planId = await fetchOrgPlan(orgId) } catch { /* garde planId par défaut */ }
  }

  return {
    id: authUserId,
    nom: profile?.nom || umeta.nom || authUser.email?.split('@')[0] || '',
    role: profile?.role || meta.role || umeta.role || 'employe',
    email: authUser.email ?? profile?.email ?? '',
    chIds: chIdsFromProfile(profile, authUser),
    vierge: profile?.vierge ?? umeta.vierge ?? true,
    orgId,
    planId,
    isSupabase: true,
  }
}

export async function signInWithEmail(email, password) {
  const { data, error } = await sb().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error) throw error
  return fetchAppUser(data.user.id)
}

export async function signUpWithEmail({ email, password, nom, entreprise }) {
  const emailNorm = email.trim().toLowerCase()
  const { data, error } = await sb().auth.signUp({
    email: emailNorm,
    password,
    options: {
      data: {
        nom: (nom || '').trim(),
        entreprise: (entreprise || '').trim(),
        signup: 'true',
      },
    },
  })
  if (error) throw error
  if (!data.user) throw new Error('Inscription impossible')

  if (data.session) {
    await ensureSignupComplete(data.user)
    return { user: await fetchAppUser(data.user.id), needsEmailConfirmation: false }
  }

  return { user: null, needsEmailConfirmation: true, email: emailNorm }
}

export async function resetPassword(email) {
  const { error } = await sb().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await sb().auth.signOut()
  if (error) throw error
}

export async function getSessionUser() {
  const { data: { session } } = await sb().auth.getSession()
  if (!session?.user) return null
  return fetchAppUser(session.user.id)
}

export function onAuthChange(callback) {
  const { data: { subscription } } = sb().auth.onAuthStateChange(
    async (_event, session) => {
      if (session?.user) {
        try {
          callback(await fetchAppUser(session.user.id))
        } catch (e) {
          console.warn('[BuildEasy] Profil introuvable:', e?.message)
          callback(null)
        }
      } else {
        callback(null)
      }
    }
  )
  return () => subscription.unsubscribe()
}

export { isSupabaseConfigured }
