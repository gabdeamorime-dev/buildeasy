const ALLOWED_ORIGINS = [
  'https://buildeasy.vercel.app',
  'https://buildeasy.eu',
  'https://www.buildeasy.eu',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
]

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  }
}

export function safeAppOrigin(req: Request): string {
  const origin = req.headers.get('origin') || ''
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
}
