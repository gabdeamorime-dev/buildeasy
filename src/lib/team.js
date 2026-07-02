/**
 * Équipe — invitations, membres, parrainage (RPC Supabase).
 */
import { supabase, isSupabaseConfigured } from '../supabase.js'

const INVITE_KEY = 'be_invite_token'

const ROLE_FN = {
  admin: 'Gérant',
  chef: 'Chef de chantier',
  employe: 'Compagnon',
  client: 'Client MOA',
}

function sb() {
  if (!supabase) throw new Error('Supabase non configuré')
  return supabase
}

export function persistInviteToken(token) {
  const t = (token || '').trim()
  if (!t || typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(INVITE_KEY, t)
}

export function getStoredInviteToken() {
  if (typeof sessionStorage === 'undefined') return ''
  return sessionStorage.getItem(INVITE_KEY) || ''
}

export function clearInviteToken() {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(INVITE_KEY)
}

/** Fusionne les comptes Supabase dans la liste équipe UI (présence terrain). */
export function mergeEquipeWithOrgMembers(equipeRows, members) {
  const rows = Array.isArray(equipeRows) ? [...equipeRows] : []
  const byUserId = new Set(rows.map((m) => m.userId || m.user_id).filter(Boolean))
  const byEmail = new Map(
    rows.filter((m) => m.email).map((m) => [String(m.email).toLowerCase(), m]),
  )
  let nextId = Math.max(0, ...rows.map((m) => Number(m.id) || 0)) + 1

  for (const p of members || []) {
    if (p.id && byUserId.has(p.id)) continue
    const email = (p.email || '').toLowerCase()
    if (email && byEmail.has(email)) {
      const existing = byEmail.get(email)
      existing.userId = p.id
      existing.fn = existing.fn || ROLE_FN[p.role] || p.role
      continue
    }
    rows.push({
      id: nextId++,
      userId: p.id,
      nom: p.nom || p.email?.split('@')[0] || 'Membre',
      fn: ROLE_FN[p.role] || p.role || '',
      tel: '',
      email: p.email || '',
      chIds: Array.isArray(p.chantier_ids) ? p.chantier_ids : [],
      statut: 'present',
      tauxH: 35,
      qual: 'N2',
      isAccount: true,
    })
  }
  return rows
}

export function inviteJoinUrl(token) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/app/join?token=${encodeURIComponent(token)}`
}

export function referralSignupUrl(code) {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/?ref=${encodeURIComponent(code)}`
}

export async function previewInvitation(token) {
  if (!token) return { valid: false, error: 'Lien invalide' }
  const { data, error } = await sb().rpc('get_invitation_preview', { p_token: token })
  if (error) throw new Error(error.message)
  return data
}

export async function createInvitation({ email, role = 'employe', chantierIds = [] }) {
  const { data, error } = await sb().rpc('create_org_invitation', {
    p_email: email.trim().toLowerCase(),
    p_role: role,
    p_chantier_ids: chantierIds,
  })
  if (error) throw new Error(error.message)
  return { ...data, joinUrl: inviteJoinUrl(data.token) }
}

export async function acceptInvitation(token) {
  const { data, error } = await sb().rpc('accept_org_invitation', { p_token: token })
  if (error) throw new Error(error.message)
  return data
}

export async function listInvitations() {
  const { data, error } = await sb().rpc('list_org_invitations')
  if (error) throw new Error(error.message)
  if (Array.isArray(data)) return data
  if (typeof data === 'string') {
    try { return JSON.parse(data) } catch { return [] }
  }
  return []
}

export async function listOrgMembers() {
  const { data, error } = await sb().rpc('list_org_members')
  if (error) throw new Error(error.message)
  if (Array.isArray(data)) return data
  if (typeof data === 'string') {
    try { return JSON.parse(data) } catch { return [] }
  }
  return []
}

export async function getReferralInfo() {
  const { data, error } = await sb().rpc('get_referral_info')
  if (error) throw new Error(error.message)
  return {
    ...data,
    signupUrl: data?.code ? referralSignupUrl(data.code) : null,
  }
}

export async function countOrgMembers(orgId) {
  if (!orgId) return 0
  const { count, error } = await sb()
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
  if (error) return 0
  return count ?? 0
}

export async function getOrgUsageStats() {
  const { data, error } = await sb().rpc('get_org_usage_stats')
  if (error) throw new Error(error.message)
  return {
    members: data?.members ?? 0,
    pendingInvites: data?.pending_invites ?? 0,
    limit: data?.limit ?? 5,
  }
}

export async function loadEquipeWithAccounts(equipeRows) {
  try {
    const members = await listOrgMembers()
    if (!members.length) return equipeRows
    return mergeEquipeWithOrgMembers(equipeRows, members)
  } catch {
    return equipeRows
  }
}

export { isSupabaseConfigured }
