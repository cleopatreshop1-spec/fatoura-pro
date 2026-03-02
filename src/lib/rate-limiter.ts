import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'

let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required')
    }
    redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return redis
}

export const rateLimiters = {
  auth: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '15 m'),
    prefix: 'fp:auth',
  }),
  ttnSubmit: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(30, '1 h'),
    prefix: 'fp:ttn',
  }),
  api: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    prefix: 'fp:api',
  }),
  export: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(20, '10 m'),
    prefix: 'fp:export',
  }),
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'anonymous'
  )
}

export async function applyRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<Response | null> {
  try {
    const { success, limit, remaining, reset } = await limiter.limit(identifier)
    if (!success) {
      return Response.json(
        { error: 'Trop de requêtes. Veuillez réessayer dans quelques instants.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit':     limit.toString(),
            'X-RateLimit-Remaining': '0',
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
