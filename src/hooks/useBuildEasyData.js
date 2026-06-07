import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase.js'
import { rowToApp, appToRow, rowsToApp } from '../lib/mappers.js'

const TABLES = [
  'chantiers',
  'taches',
  'factures',
  'equipe',
  'rapports',
  'messages',
  'avenants',
  'heures',
  'punch',
  'incidents',
  'situations',
  'devis',
  'commandes',
  'planning_eq',
  'conges',
  'agenda',
  'notes',
  'clients',
  'fournisseurs',
]

const CAMEL = {
  chantiers: 'chantiers',
  taches: 'taches',
  factures: 'factures',
  equipe: 'equipe',
  rapports: 'rapports',
  messages: 'messages',
  avenants: 'avenants',
  heures: 'heures',
  punch: 'punch',
  incidents: 'incidents',
  situations: 'situations',
  devis: 'devis',
  commandes: 'commandes',
  planning_eq: 'planningEq',
  conges: 'conges',
  agenda: 'agenda',
  notes: 'notes',
  clients: 'clients',
  fournisseurs: 'fournisseurs',
}

async function loadTable(table) {
  const { data, error } = await supabase.from(table).select('*').order('id', { ascending: true })
  if (error) throw error
  return rowsToApp(data)
}

async function insertRow(table, item, orgId) {
  const row = appToRow(item, orgId)
  delete row.id
  const { data, error } = await supabase.from(table).insert(row).select().single()
  if (error) throw error
  return rowToApp(data)
}

async function updateRow(table, id, patch, orgId) {
  const row = appToRow(patch, orgId, { partial: true })
  delete row.org_id
  const q = supabase.from(table).update(row).eq('id', id)
  const { data, error } = await q.select().single()
  if (error) throw error
  return rowToApp(data)
}

async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}

/** Factures : clé texte */
async function updateFacture(id, patch) {
  const row = appToRow(patch, null, { partial: true })
  const { data, error } = await supabase.from('factures').update(row).eq('id', id).select().single()
  if (error) throw error
  return rowToApp(data)
}

async function insertFacture(item, orgId) {
  const row = appToRow(item, orgId)
  const { data, error } = await supabase.from('factures').insert(row).select().single()
  if (error) throw error
  return rowToApp(data)
}

export function useBuildEasyData(user) {
  const orgId = user?.orgId
  const orgRef = useRef(orgId)
  orgRef.current = orgId

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [chantiers, setChantiers] = useState([])
  const [taches, setTaches] = useState([])
  const [factures, setFactures] = useState([])
  const [equipe, setEquipe] = useState([])
  const [rapports, setRapports] = useState([])
  const [messages, setMessages] = useState([])
  const [avenants, setAvenants] = useState([])
  const [heures, setHeures] = useState([])
  const [punch, setPunch] = useState([])
  const [incidents, setIncidents] = useState([])
  const [situations, setSituations] = useState([])
  const [devis, setDevis] = useState([])
  const [commandes, setCommandes] = useState([])
  const [planningEq, setPlanningEq] = useState([])
  const [conges, setConges] = useState([])
  const [agenda, setAgenda] = useState([])
  const [notes, setNotes] = useState([])
  const [clients, setClients] = useState([])
  const [fournisseurs, setFournisseurs] = useState([])
  const [planId, setPlanIdState] = useState(user?.planId || 'pro')

  const setters = {
    chantiers: setChantiers,
    taches: setTaches,
    factures: setFactures,
    equipe: setEquipe,
    rapports: setRapports,
    messages: setMessages,
    avenants: setAvenants,
    heures: setHeures,
    punch: setPunch,
    incidents: setIncidents,
    situations: setSituations,
    devis: setDevis,
    commandes: setCommandes,
    planningEq: setPlanningEq,
    conges: setConges,
    agenda: setAgenda,
    notes: setNotes,
    clients: setClients,
    fournisseurs: setFournisseurs,
  }

  const refresh = useCallback(async () => {
    if (!orgId) {
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.all(TABLES.map((t) => loadTable(t)))
      TABLES.forEach((t, i) => setters[CAMEL[t]](results[i]))
      if (user?.planId) setPlanIdState(user.planId)
    } catch (e) {
      setError(e.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [orgId, user?.planId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const setPlanId = useCallback(
    async (pid) => {
      setPlanIdState(pid)
      if (!orgId) return
      const { error: e } = await supabase.from('organizations').update({ plan_id: pid }).eq('id', orgId)
      if (e) console.error(e)
    },
    [orgId]
  )

  const editT = useCallback(async (id, k, v) => {
    setTaches((p) => p.map((t) => (t.id === id ? { ...t, [k]: v } : t)))
    try {
      await updateRow('taches', id, { [k]: v }, orgRef.current)
    } catch (e) {
      console.error(e)
      refresh()
    }
  }, [refresh])

  const addC = useCallback(
    async (f) => {
      const item = {
        nom: f.nom || '',
        client: f.client || '',
        tel: f.tel || '',
        corps: f.corps || '',
        statut: 'planif',
        av: 0,
        budget: parseInt(f.budget, 10) || 0,
        dep: 0,
        debut: f.debut || '',
        fin: f.fin || '',
        rdv: f.rdv || '',
        meteo: f.meteo || '—',
        prio: parseInt(f.prio, 10) || 2,
        note: f.note || '',
        adresse: f.adresse || '',
        taux: parseInt(f.taux, 10) || 35,
      }
      try {
        const saved = await insertRow('chantiers', item, orgRef.current)
        setChantiers((p) => [...p, saved])
        if (f.eqIds?.length) {
          for (const mid of f.eqIds) {
            const m = equipe.find((x) => x.id === mid)
            if (!m) continue
            const chIds = [...new Set([...(m.chIds || []), saved.id])]
            setEquipe((p) => p.map((x) => (x.id === mid ? { ...x, chIds } : x)))
            await updateRow('equipe', mid, { chIds }, orgRef.current)
          }
        }
        return saved
      } catch (e) {
        console.error(e)
        throw e
      }
    },
    [equipe]
  )

  const saveC = useCallback(
    async (f) => {
      setChantiers((p) => p.map((c) => (c.id === f.id ? { ...c, ...f } : c)))
      try {
        await updateRow('chantiers', f.id, f, orgRef.current)
        if (f.eqIds) {
          for (const m of equipe) {
            const next = f.eqIds.includes(m.id)
              ? [...new Set([...(m.chIds || []).filter((x) => x !== f.id), f.id])]
              : (m.chIds || []).filter((x) => x !== f.id)
            if (JSON.stringify(next) !== JSON.stringify(m.chIds || [])) {
              setEquipe((p) => p.map((x) => (x.id === m.id ? { ...x, chIds: next } : x)))
              await updateRow('equipe', m.id, { chIds: next }, orgRef.current)
            }
          }
        }
      } catch (e) {
        console.error(e)
        refresh()
      }
    },
    [equipe, refresh]
  )

  const addT = useCallback(async (f) => {
    const item = {
      chId: parseInt(f.chId, 10),
      titre: f.titre,
      resp: f.resp || '',
      debut: f.debut || '',
      fin: f.fin || '',
      statut: 'planif',
      duree: Math.max(1, f.duree || 1),
      prio: parseInt(f.prio, 10) || 2,
    }
    const saved = await insertRow('taches', item, orgRef.current)
    setTaches((p) => [...p, saved])
  }, [])

  const addR = useCallback(async (f) => {
    const item = {
      chId: parseInt(f.chId, 10) || 0,
      date: f.date || '',
      auteur: f.auteur || '',
      meteo: f.meteo || '',
      av: f.av || '',
      incidents: f.incidents || 'RAS',
      presences: f.presences || [],
    }
    const saved = await insertRow('rapports', item, orgRef.current)
    setRapports((p) => [...p, saved])
  }, [])

  const sendMsg = useCallback(async (m) => {
    const saved = await insertRow('messages', m, orgRef.current)
    setMessages((p) => [...p, saved])
  }, [])

  const addAv = useCallback(async (f) => {
    const saved = await insertRow('avenants', f, orgRef.current)
    setAvenants((p) => [...p, saved])
  }, [])

  const valAv = useCallback(
    async (id, s, par) => {
      const ds = new Date().toLocaleDateString('fr-FR')
      setAvenants((p) => p.map((a) => (a.id === id ? { ...a, statut: s, par, ds } : a)))
      await updateRow('avenants', id, { statut: s, par, ds }, orgRef.current)
    },
    []
  )

  const valH = useCallback(async (id) => {
    setHeures((p) => p.map((h) => (h.id === id ? { ...h, val: true } : h)))
    await updateRow('heures', id, { val: true }, orgRef.current)
  }, [])

  const addP = useCallback(async (f) => {
    const saved = await insertRow('punch', f, orgRef.current)
    setPunch((p) => [...p, saved])
  }, [])

  const updP = useCallback(async (id, s) => {
    const clos = s === 'clos' ? new Date().toLocaleDateString('fr-FR') : ''
    setPunch((p) => p.map((i) => (i.id === id ? { ...i, statut: s, clos } : i)))
    await updateRow('punch', id, { statut: s, clos }, orgRef.current)
  }, [])

  const addInc = useCallback(async (f) => {
    const item = { ts: Date.now(), ...f }
    const saved = await insertRow('incidents', item, orgRef.current)
    setIncidents((p) => [...p, saved])
  }, [])

  const updInc = useCallback(
    async (id, changes) => {
      const patch = typeof changes === 'string' ? { statut: changes } : changes
      setIncidents((p) => p.map((i) => (i.id === id ? { ...i, ...patch } : i)))
      await updateRow('incidents', id, patch, orgRef.current)
    },
    []
  )

  const delInc = useCallback(async (id) => {
    setIncidents((p) => p.filter((i) => i.id !== id))
    await deleteRow('incidents', id)
  }, [])

  const onUpdCh = useCallback(
    async (id, k, v) => {
      setChantiers((p) => p.map((c) => (c.id === id ? { ...c, [k]: v } : c)))
      await updateRow('chantiers', id, { [k]: v }, orgRef.current)
    },
    []
  )

  const onAddNote = useCallback(async (n) => {
    const item = {
      date: new Date().toLocaleDateString('fr-FR'),
      ts: Date.now(),
      ...n,
    }
    const saved = await insertRow('notes', item, orgRef.current)
    setNotes((p) => [...p, saved])
  }, [])

  const onDelNote = useCallback(async (id) => {
    setNotes((p) => p.filter((x) => x.id !== id))
    await deleteRow('notes', id)
  }, [])

  const onChangeFactureStatut = useCallback(async (id, s) => {
    setFactures((p) => p.map((f) => (f.id === id ? { ...f, statut: s } : f)))
    await updateFacture(id, { statut: s })
  }, [])

  const onSaveSituation = useCallback(async (s) => {
    const saved = await insertRow('situations', s, orgRef.current)
    setSituations((p) => [...p, saved])
  }, [])

  const onChangeSituationStatut = useCallback(async (id, s) => {
    setSituations((p) => p.map((x) => (x.id === id ? { ...x, statut: s } : x)))
    await updateRow('situations', id, { statut: s }, orgRef.current)
  }, [])

  const onAddDevis = useCallback(async (d) => {
    const saved = await insertRow('devis', d, orgRef.current)
    setDevis((p) => [...p, saved])
  }, [])

  const onChangeDevisStatut = useCallback(async (id, s) => {
    setDevis((p) => p.map((d) => (d.id === id ? { ...d, statut: s } : d)))
    await updateRow('devis', id, { statut: s }, orgRef.current)
  }, [])

  const onEditDevis = useCallback(async (id, changes) => {
    setDevis((p) => p.map((d) => (d.id === id ? { ...d, ...changes } : d)))
    await updateRow('devis', id, changes, orgRef.current)
  }, [])

  const onAddCmd = useCallback(async (c) => {
    const saved = await insertRow('commandes', c, orgRef.current)
    setCommandes((p) => [...p, saved])
  }, [])

  const onReceptionCmd = useCallback(async (id) => {
    const livraison = new Date().toLocaleDateString('fr-FR')
    setCommandes((p) =>
      p.map((c) => (c.id === id ? { ...c, statut: 'livree', livraison } : c))
    )
    await updateRow('commandes', id, { statut: 'livree', livraison }, orgRef.current)
  }, [])

  const onEditPlanning = useCallback(async (memId, ji, chId) => {
    setPlanningEq((p) => {
      const next = p.map((m) =>
        m.id === memId
          ? { ...m, sem: m.sem.map((s, i) => (i === ji ? { ...s, chId } : s)) }
          : m
      )
      const mem = next.find((m) => m.id === memId)
      if (mem) updateRow('planning_eq', memId, { sem: mem.sem }, orgRef.current).catch(console.error)
      return next
    })
  }, [])

  const onValiderConge = useCallback(async (id, s) => {
    setConges((p) => p.map((c) => (c.id === id ? { ...c, statut: s } : c)))
    await updateRow('conges', id, { statut: s }, orgRef.current)
  }, [])

  const onDelAgenda = useCallback(async (id) => {
    setAgenda((p) => p.filter((e) => e.id !== id))
    await deleteRow('agenda', id)
  }, [])

  const onAddFournisseur = useCallback(async (f) => {
    const saved = await insertRow('fournisseurs', f, orgRef.current)
    setFournisseurs((p) => [...p, saved])
  }, [])

  const onEditFournisseur = useCallback(async (id, f) => {
    setFournisseurs((p) => p.map((x) => (x.id === id ? { ...x, ...f } : x)))
    await updateRow('fournisseurs', id, f, orgRef.current)
  }, [])

  const onDelFournisseur = useCallback(async (id) => {
    setFournisseurs((p) => p.filter((x) => x.id !== id))
    await deleteRow('fournisseurs', id)
  }, [])

  const onUpdEq = useCallback(async (id, s) => {
    setEquipe((p) => p.map((m) => (m.id === id ? { ...m, statut: s } : m)))
    await updateRow('equipe', id, { statut: s }, orgRef.current)
  }, [])

  const onAddConge = useCallback(async (c) => {
    const saved = await insertRow('conges', c, orgRef.current)
    setConges((p) => [...p, saved])
  }, [])

  const onAddAgenda = useCallback(async (e) => {
    const date = e.date
      ? new Date(e.date + 'T12:00:00').toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
        })
      : e.date
    const saved = await insertRow('agenda', { ...e, date }, orgRef.current)
    setAgenda((p) => [...p, saved])
  }, [])

  const onAddClient = useCallback(async (c) => {
    const saved = await insertRow('clients', c, orgRef.current)
    setClients((p) => [...p, saved])
  }, [])

  const onAddFacture = useCallback(async (f) => {
    const saved = await insertFacture(f, orgRef.current)
    setFactures((p) => [...p, saved])
  }, [])

  const onAddHeure = useCallback(async (h) => {
    const saved = await insertRow('heures', h, orgRef.current)
    setHeures((p) => [...p, saved])
  }, [])

  return {
    loading,
    error,
    refresh,
    chantiers,
    taches,
    factures,
    equipe,
    rapports,
    messages,
    avenants,
    heures,
    punch,
    incidents,
    situations,
    devis,
    commandes,
    planningEq,
    conges,
    agenda,
    notes,
    clients,
    fournisseurs,
    planId,
    setPlanId,
    editT,
    addC,
    saveC,
    addT,
    addR,
    sendMsg,
    addAv,
    valAv,
    valH,
    addP,
    updP,
    addInc,
    updInc,
    delInc,
    onUpdCh,
    onAddNote,
    onDelNote,
    onChangeFactureStatut,
    onSaveSituation,
    onChangeSituationStatut,
    onAddDevis,
    onChangeDevisStatut,
    onEditDevis,
    onAddCmd,
    onReceptionCmd,
    onEditPlanning,
    onValiderConge,
    onDelAgenda,
    onAddFournisseur,
    onEditFournisseur,
    onDelFournisseur,
    onUpdEq,
    onAddConge,
    onAddAgenda,
    onAddClient,
    onAddFacture,
    onAddHeure,
  }
}
