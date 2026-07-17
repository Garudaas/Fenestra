import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://dojlbfnfhkfltlxggxiy.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_CmCFzsQ_L8dk7NxUmIVZ0g_pl_jq0fV'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
