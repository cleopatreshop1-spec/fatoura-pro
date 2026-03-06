import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'

// ── Lazy Redis singleton ──────────────────────────────────────────────────────
let _redis: Redis | null = null

function getRedis(): Redis | null {
  if (_redis) return _redis
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    console.warn('[RateLimit] UPSTASH credentials missing — rate limiting disabled')
    return null
  }
  _redis = new Redis({ url, token })
  return _redis
}

// ── Lazy rate limiter factory ─────────────────────────────────────────────────
function makeLimiter(limiter: Ratelimit['limiter'], prefix: string): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null
  return new Ratelimit({ redis, limiter, prefix })
}

// ── Rate limiters (lazy, null-safe) ──────────────────────────────────────────
export const rateLimiters = {
  get auth()      { return makeLimiter(Ratelimit.slidingWindow(10,  '15 m'), 'fp:auth')      },
  get ttnSubmit() { return makeLimiter(Ratelimit.slidingWindow(30,  '1 h'),  'fp:ttn')       },
  get api()       { return makeLimiter(Ratelimit.slidingWindow(100, '1 m'),  'fp:api')       },
  get export()    { return makeLimiter(Ratelimit.slidingWindow(20,  '10 m'), 'fp:export')    },
  get ai()        { return makeLimiter(Ratelimit.slidingWindow(20,  '1 h'),  'fp:ai')        },
  get ocr()       { return makeLimiter(Ratelimit.slidingWindow(20,  '1 h'),  'fp:ocr')       },
  get letters()   { return makeLimiter(Ratelimit.slidingWindow(30,  '1 h'),  'fp:letters')   },
  get summaries() { return makeLimiter(Ratelimit.slidingWindow(50,  '1 h'),  'fp:summaries') },
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'anonymous'
  )
}

export async function applyRateLimit(
  limiter: Ratelimit | null | undefined,
  identifier: string
): Promise<Response | null> {
  if (!limiter) return null   // Upstash not configured — skip silently
  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier)
    if (!success) {
      return Response.json(
        { error: 'Trop de requêtes. Veuillez réessayer dans quelques instants.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit':     limit.toString(),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset':     reset.toString(),
            'Retry-After':           Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      )
    }
  } catch {
    // If Redis is unavailable, fail open (don't block the request)
    console.warn('[RateLimit] Redis unavailable, skipping rate limit check')
  }
  return null
}
