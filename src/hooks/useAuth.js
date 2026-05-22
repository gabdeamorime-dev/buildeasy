import { useState, useEffect, useCallback } from 'react'

import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

import {

  loadUserFromSession,

  signInWithEmail,

  signOut as authSignOut,

  getSession,

} from '../lib/auth.js'

import { findDemoAccount, demoAccountToUser } from '../lib/demoData.js'



export function useAuth() {

  const [user, setUser] = useState(null)

  const [authLoading, setAuthLoading] = useState(true)



  useEffect(() => {

    if (!isSupabaseConfigured || !supabase) {

      setAuthLoading(false)

      return

    }



    let mounted = true



    const init = async () => {

      try {

        const session = await getSession()

        if (session && mounted) {

          const u = await loadUserFromSession(session)

          if (mounted) setUser(u)

        }

      } catch (e) {

        console.error('[BuildEasy] Session init:', e)

        if (mounted) setUser(null)

      } finally {

        if (mounted) setAuthLoading(false)

      }

    }



    init()



    const {

      data: { subscription },

    } = supabase.auth.onAuthStateChange(async (event, session) => {

      if (!mounted) return

      if (event === 'SIGNED_OUT') {

        setUser(null)

        return

      }

      if (session && event === 'SIGNED_IN') {

        try {

          const u = await loadUserFromSession(session)

          if (mounted) setUser(u)

        } catch (e) {

          console.error('[BuildEasy] Profil:', e)

          if (mounted) setUser(null)

        }

      }

    })



    return () => {

      mounted = false

      subscription.unsubscribe()

    }

  }, [])



  const signIn = useCallback(async (email, password) => {

    if (!isSupabaseConfigured) {

      const account = findDemoAccount(email, password)

      if (!account) {

        const err = new Error('Invalid login credentials')

        throw err

      }

      const u = demoAccountToUser(account)

      setUser(u)

      return u

    }

    const u = await signInWithEmail(email, password)

    setUser(u)

    return u

  }, [])



  const signOut = useCallback(async () => {

    if (isSupabaseConfigured) {

      await authSignOut()

    }

    setUser(null)

  }, [])



  return { user, authLoading, signIn, signOut, isConfigured: isSupabaseConfigured }

}


