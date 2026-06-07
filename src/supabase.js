import { createClient } from '@supabase/supabase-js'

const url =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL

const key =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  console.warn(
    '[BuildEasy] Variables manquantes : définissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (ou NEXT_PUBLIC_*) dans .env'
  )
}

export const supabase = createClient(url || '', key || '')
