import { useCallback, useEffect, useState } from 'react'
import {
  createInvitation,
  listInvitations,
  listOrgMembers,
  getReferralInfo,
  inviteJoinUrl,
  isSupabaseConfigured,
} from '../lib/team.js'

const ROLE_OPTS = [
  { v: 'admin', l: 'Gérant' },
  { v: 'chef', l: 'Chef de chantier' },
  { v: 'employe', l: 'Compagnon' },
  { v: 'client', l: 'Client MOA' },
]

const ROLE_LABEL = Object.fromEntries(ROLE_OPTS.map((r) => [r.v, r.l]))

function copyText(text, onDone) {
  navigator.clipboard?.writeText(text).then(() => onDone?.('Copié')).catch(() => onDone?.('Copie impossible'))
}

export default function TeamPanel({ user, plan, onNotify }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('employe')
  const [load, setLoad] = useState(false)
  const [err, setErr] = useState('')
  const [invites, setInvites] = useState([])
  const [members, setMembers] = useState([])
  const [referral, setReferral] = useState(null)

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || user?.role !== 'admin') return
    try {
      const [inv, mem, ref] = await Promise.all([
        listInvitations(),
        listOrgMembers(),
        getReferralInfo(),
      ])
      setInvites(Array.isArray(inv) ? inv : [])
      setMembers(Array.isArray(mem) ? mem : [])
      setReferral(ref)
    } catch (e) {
      console.warn('[BuildEasy] team:', e?.message)
    }
  }, [user?.role])

  useEffect(() => {
    refresh()
  }, [refresh])

  const notify = (msg) => onNotify?.(msg)

  const onInvite = async () => {
    setErr('')
    const em = email.trim().toLowerCase()
    if (!em.includes('@')) {
      setErr('Email invalide')
      return
    }
    setLoad(true)
    try {
      const inv = await createInvitation({ email: em, role })
      setEmail('')
      notify(`Invitation envoyée à ${em}`)
      copyText(inv.joinUrl, notify)
      await refresh()
    } catch (e) {
      setErr(e?.message || 'Invitation impossible')
    } finally {
      setLoad(false)
    }
  }

  if (!isSupabaseConfigured || user?.role !== 'admin' || user?.isLocal) return null

  const pending = invites.filter((i) => !i.accepted_at && new Date(i.expires_at) > new Date())
  const lim = plan?.maxUsers ?? 5
  const nbMembers = members.length
  const nbPending = pending.length
  const nbTotal = nbMembers + nbPending

  return (
    <div>
      <div className="sec">Inviter un collaborateur</div>
      <div className="panel panel-bd">
        <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>
          {nbTotal}{lim === Infinity ? '' : ` / ${lim}`} utilisateurs
          {nbPending > 0 ? ` · ${nbPending} invitation(s) en attente` : ''}
        </div>
        <input
          className="inp"
          style={{ marginBottom: 8 }}
          type="email"
          placeholder="Email professionnel"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select className="inp" style={{ marginBottom: 10 }} value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLE_OPTS.map((r) => (
            <option key={r.v} value={r.v}>{r.l}</option>
          ))}
        </select>
        {err && (
          <div className="tag tag-err" style={{ display: 'block', padding: '8px 10px', marginBottom: 10, fontSize: 12 }}>
            {err}
          </div>
        )}
        <button type="button" className="btn btn-blue btn-fw" onClick={onInvite} disabled={load || !email.trim()}>
          {load ? 'Envoi…' : 'Créer le lien d\'invitation'}
        </button>
        <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 8, lineHeight: 1.5 }}>
          Un lien unique sera copié — partagez-le à votre collaborateur par email ou SMS.
        </div>
      </div>

      {pending.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="sec">Invitations en attente</div>
          <div className="col gap8">
            {pending.map((inv) => (
              <div key={inv.id} className="card" style={{ padding: '12px 14px' }}>
                <div className="row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{inv.email}</div>
                    <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 2 }}>
                      {ROLE_LABEL[inv.role] || inv.role}
                      {' · expire '}
                      {new Date(inv.expires_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-out btn-xs"
                    onClick={() => copyText(inviteJoinUrl(inv.token), notify)}
                  >
                    Copier le lien
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {members.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="sec">Comptes connectés ({members.length})</div>
          <div className="col gap8">
            {members.map((m) => (
              <div key={m.id} className="card" style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{m.nom || m.email}</div>
                <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 2 }}>
                  {m.email} · {ROLE_LABEL[m.role] || m.role}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {referral?.code && (
        <div style={{ marginTop: 16 }}>
          <div className="sec">Parrainage</div>
          <div className="panel panel-bd">
            <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 8 }}>
              Partagez votre lien — chaque nouvelle entreprise inscrite compte comme un filleul.
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', marginBottom: 8, fontFamily: 'ui-monospace,monospace' }}>
              {referral.signupUrl || `/?ref=${referral.code}`}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                className="btn btn-out btn-sm"
                onClick={() => copyText(referral.signupUrl || `${window.location.origin}/?ref=${referral.code}`, notify)}
              >
                Copier le lien
              </button>
              <span style={{ fontSize: 12, color: 'var(--t4)', alignSelf: 'center' }}>
                {(referral.uses_count ?? referral.count ?? 0)} filleul(s)
              </span>
            </div>
            {Array.isArray(referral.referrals) && referral.referrals.length > 0 && (
              <div className="col gap8">
                {referral.referrals.map((r) => (
                  <div key={r.org_id} className="card" style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>
                      {r.org_name || 'Nouvelle entreprise'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 2 }}>
                      {r.status || 'inscrit'} · {r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
