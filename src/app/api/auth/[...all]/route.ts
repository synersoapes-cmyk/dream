import { eq } from 'drizzle-orm';
import { toNextJsHandler } from 'better-auth/next-js';

import { getAuth } from '@/core/auth';
import { db } from '@/core/db';
import { resetD1DevBindingCache } from '@/core/db/d1';
import { session, user } from '@/config/db/schema';
import { isCloudflareWorker } from '@/shared/lib/env';
import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';

const GET_SESSION_RETRY_ATTEMPTS = 3;

function isGetSessionRequest(request: Request) {
  return new URL(request.url).pathname.endsWith('/api/auth/get-session');
}

function maybeRateLimitGetSession(request: Request): Response | null {
  // better-auth session endpoint is served under this catch-all route.
  if (isCloudflareWorker || !isGetSessionRequest(request)) {
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

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function readSessionTokenFromCookie(request: Request) {
  const rawCookie = request.headers.get('cookie') || '';
  const tokenPair = rawCookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith('better-auth.session_token='));

  if (!tokenPair) {
    return null;
  }

  const encodedToken = tokenPair.split('=').slice(1).join('=');
  if (!encodedToken) {
    return null;
  }

  const decodedToken = decodeURIComponent(encodedToken);
  const [token] = decodedToken.split('.');
  return token || null;
}

async function buildFallbackSessionResponse(request: Request) {
  const token = readSessionTokenFromCookie(request);
  if (!token) {
    return Response.json(null);
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const [sessionRow] = await db()
        .select()
        .from(session)
        .where(eq(session.token, token))
        .limit(1);

      if (!sessionRow || sessionRow.expiresAt.getTime() <= Date.now()) {
        return Response.json(null);
      }

      const [userRow] = await db()
        .select()
        .from(user)
        .where(eq(user.id, sessionRow.userId))
        .limit(1);

      if (!userRow) {
        return Response.json(null);
      }

      return Response.json({
        session: sessionRow,
        user: userRow,
      });
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }
      await resetD1DevBindingCache();
      await delay(attempt * 120);
    }
  }

  return Response.json(null);
}

async function executeAuthHandler(
  request: Request,
  method: 'GET' | 'POST'
) {
  const startedAt = Date.now();
  const shouldRetry = isGetSessionRequest(request);
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= (shouldRetry ? GET_SESSION_RETRY_ATTEMPTS : 1);
    attempt += 1
  ) {
    try {
      const auth = await getAuth();
      const authReadyAt = Date.now();
      const handler = toNextJsHandler(auth.handler);
      const response =
        method === 'GET'
          ? await handler.GET(request.clone())
          : await handler.POST(request.clone());

      if (!shouldRetry || response.status < 500) {
        if (
          process.env.NODE_ENV !== 'production' &&
          isGetSessionRequest(request)
        ) {
          console.log(`[auth-route] ${method} /api/auth/get-session timings`, {
            attempt,
            getAuthMs: authReadyAt - startedAt,
            handlerMs: Date.now() - authReadyAt,
            totalMs: Date.now() - startedAt,
            status: response.status,
          });
        }

        return response;
      }

      if (attempt === GET_SESSION_RETRY_ATTEMPTS) {
        const fallbackResponse = await buildFallbackSessionResponse(request);

        if (process.env.NODE_ENV !== 'production') {
          console.warn('[auth-route] Falling back to direct session lookup');
        }

        return fallbackResponse;
      }

      await resetD1DevBindingCache();
      await delay(attempt * 120);
    } catch (error) {
      lastError = error;

      if (!shouldRetry) {
        throw error;
      }

      if (attempt === GET_SESSION_RETRY_ATTEMPTS) {
        return buildFallbackSessionResponse(request);
      }

      await resetD1DevBindingCache();
      await delay(attempt * 120);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Unknown auth route error');
}

export async function POST(request: Request) {
  const limited = maybeRateLimitGetSession(request);
  if (limited) {
    return limited;
  }

  return executeAuthHandler(request, 'POST');
}

export async function GET(request: Request) {
  const limited = maybeRateLimitGetSession(request);
  if (limited) {
    return limited;
  }

  return executeAuthHandler(request, 'GET');
}
