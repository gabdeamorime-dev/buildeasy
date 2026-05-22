import { useState, useEffect, useCallback, useRef } from 'react'

import { isSupabaseConfigured } from '../lib/supabase.js'

import { getInitialDemoData } from '../lib/demoData.js'

import { createDemoStore } from '../lib/demoStore.js'

import * as db from '../lib/db.js'



function withSaving(setSaving, fn) {

  return async (...args) => {

    setSaving(true)

    try {

      return await fn(...args)

    } finally {

      setSaving(false)

    }

  }

}



export function useBuildEasyData() {

  const demoStoreRef = useRef(null)

  if (!isSupabaseConfigured && !demoStoreRef.current) {

    demoStoreRef.current = createDemoStore()

  }



  const [chantiers, setChantiers] = useState([])

  const [taches, setTaches] = useState([])

  const [factures, setFactures] = useState([])

  const [equipe, setEquipe] = useState([])

  const [rapports, setRapports] = useState([])

  const [messages, setMessages] = useState([])

  const [avenants, setAvenants] = useState([])

  const [heures, setHeures] = useState([])

  const [punchlist, setPunchlist] = useState([])

  const [loading, setLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState(null)



  const applyData = useCallback((data) => {

    setChantiers(data.chantiers)

    setTaches(data.taches)

    setFactures(data.factures)

    setEquipe(data.equipe)

    setRapports(data.rapports)

    setMessages(data.messages)

    setAvenants(data.avenants)

    setHeures(data.heures)

    setPunchlist(data.punchlist)

  }, [])



  const loadAll = useCallback(async () => {

    if (!isSupabaseConfigured) {

      applyData(getInitialDemoData())

      setError(null)

      setLoading(false)

      return

    }

    setLoading(true)

    setError(null)

    try {

      const data = await db.fetchAllData()

      applyData(data)

    } catch (e) {

      console.error('[BuildEasy] Chargement Supabase:', e)

      setError(e.message || 'Erreur de chargement Supabase')

    } finally {

      setLoading(false)

    }

  }, [applyData])



  useEffect(() => {

    loadAll()

  }, [loadAll])



  const save = withSaving.bind(null, setSaving)

  const store = () => demoStoreRef.current



  const addC = save(async (f) => {

    if (!isSupabaseConfigured) {

      const row = store().insertChantier(f)

      setChantiers((p) => [...p, row])

      return

    }

    const row = await db.insertChantier(f)

    setChantiers((p) => [...p, row])

  })



  const editC = save(async (id, k, v) => {

    if (!isSupabaseConfigured) {

      const row = store().updateChantier(id, k, v)

      setChantiers((p) => p.map((c) => (c.id === id ? row : c)))

      return

    }

    const row = await db.updateChantier(id, k, v)

    setChantiers((p) => p.map((c) => (c.id === id ? row : c)))

  })



  const addT = save(async (f) => {

    if (!isSupabaseConfigured) {

      const row = store().insertTache(f)

      setTaches((p) => [...p, row])

      return

    }

    const row = await db.insertTache(f)

    setTaches((p) => [...p, row])

  })



  const editT = save(async (id, k, v) => {

    if (!isSupabaseConfigured) {

      const row = store().updateTache(id, k, v)

      setTaches((p) => p.map((t) => (t.id === id ? row : t)))

      return

    }

    const row = await db.updateTache(id, k, v)

    setTaches((p) => p.map((t) => (t.id === id ? row : t)))

  })



  const addR = save(async (f) => {

    if (!isSupabaseConfigured) {

      const row = store().insertRapport(f)

      setRapports((p) => [...p, row])

      return

    }

    const row = await db.insertRapport(f)

    setRapports((p) => [...p, row])

  })



  const sendMsg = save(async (m) => {

    if (!isSupabaseConfigured) {

      const row = store().insertMessage(m)

      setMessages((p) => [...p, row])

      return

    }

    const row = await db.insertMessage(m)

    setMessages((p) => [...p, row])

  })



  const addAvenant = save(async (f) => {

    if (!isSupabaseConfigured) {

      const row = store().insertAvenant(f)

      setAvenants((p) => [...p, row])

      return

    }

    const row = await db.insertAvenant(f)

    setAvenants((p) => [...p, row])

  })



  const validerAvenant = save(async (id, statut, par) => {

    if (!isSupabaseConfigured) {

      const row = store().updateAvenant(id, statut, par)

      setAvenants((p) => p.map((a) => (a.id === id ? row : a)))

      return

    }

    const row = await db.updateAvenant(id, statut, par)

    setAvenants((p) => p.map((a) => (a.id === id ? row : a)))

  })



  const validerHeures = save(async (id, par) => {

    if (!isSupabaseConfigured) {

      const row = store().updateHeure(id, par)

      setHeures((p) => p.map((h) => (h.id === id ? row : h)))

      return

    }

    const row = await db.updateHeure(id, par)

    setHeures((p) => p.map((h) => (h.id === id ? row : h)))

  })



  const addPunchItem = save(async (f) => {

    if (!isSupabaseConfigured) {

      const row = store().insertPunchItem(f)

      setPunchlist((p) => [...p, row])

      return

    }

    const row = await db.insertPunchItem(f)

    setPunchlist((p) => [...p, row])

  })



  const updatePunchStatut = save(async (id, statut) => {

    if (!isSupabaseConfigured) {

      const row = store().updatePunchStatut(id, statut)

      setPunchlist((p) => p.map((item) => (item.id === id ? row : item)))

      return

    }

    const row = await db.updatePunchStatut(id, statut)

    setPunchlist((p) => p.map((item) => (item.id === id ? row : item)))

  })



  return {

    chantiers,

    taches,

    factures,

    equipe,

    rapports,

    messages,

    avenants,

    heures,

    punchlist,

    loading,

    saving,

    error,

    isDemoMode: !isSupabaseConfigured,

    reload: loadAll,

    addC,

    editC,

    addT,

    editT,

    addR,

    sendMsg,

    addAvenant,

    validerAvenant,

    validerHeures,

    addPunchItem,

    updatePunchStatut,

  }

}


