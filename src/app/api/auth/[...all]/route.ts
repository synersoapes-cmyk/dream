import { toNextJsHandler } from 'better-auth/next-js';

import { getAuth } from '@/core/auth';
import { isCloudflareWorker } from '@/shared/lib/env';
import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';

function maybeRateLimitGetSession(request: Request): Response | null {
  const url = new URL(request.url);
  // better-auth session endpoint is served under this catch-all route.
  if (isCloudflareWorker || !url.pathname.endsWith('/api/auth/get-session')) {
    return null;
  }

  const intervalMs =
    Number(process.env.AUTH_GET_SESSION_MIN_INTERVAL_MS) ||
    // default: 800ms (enough to stop request storms but still responsive)
    800;

  return enforceMinIntervalRateLimit(request, {
    intervalMs,
    keyPrefix: 'auth-get-session',
  });
}

export async function POST(request: Request) {
  const limited = maybeRateLimitGetSession(request);
  if (limited) {
    return limited;
  }

  const startedAt = Date.now();
  const auth = await getAuth();
  const authReadyAt = Date.now();
  const handler = toNextJsHandler(auth.handler);
  const response = await handler.POST(request);

  if (
    process.env.NODE_ENV !== 'production' &&
    new URL(request.url).pathname.endsWith('/api/auth/get-session')
  ) {
    console.log('[auth-route] POST /api/auth/get-session timings', {
      getAuthMs: authReadyAt - startedAt,
      handlerMs: Date.now() - authReadyAt,
      totalMs: Date.now() - startedAt,
      status: response.status,
    });
  }

  return response;
}

export async function GET(request: Request) {
  const limited = maybeRateLimitGetSession(request);
  if (limited) {
    return limited;
  }

  const startedAt = Date.now();
  const auth = await getAuth();
  const authReadyAt = Date.now();
  const handler = toNextJsHandler(auth.handler);
  const response = await handler.GET(request);

  if (
    process.env.NODE_ENV !== 'production' &&
    new URL(request.url).pathname.endsWith('/api/auth/get-session')
  ) {
    console.log('[auth-route] GET /api/auth/get-session timings', {
      getAuthMs: authReadyAt - startedAt,
      handlerMs: Date.now() - authReadyAt,
      totalMs: Date.now() - startedAt,
      status: response.status,
    });
  }

  return response;
}
