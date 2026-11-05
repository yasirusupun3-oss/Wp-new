import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

/**
 * Firebase Admin SDK singleton for server-side (API route) use.
 *
 * Requires these environment variables (server-only, NOT prefixed with
 * NEXT_PUBLIC_ so they never reach the browser bundle):
 *
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY   (paste the full PEM key; \n line breaks are
 *                           auto-unescaped below so it works whether the
 *                           .env value uses literal newlines or "\n")
 *
 * These come from a Firebase service account JSON
 * (Firebase Console → Project Settings → Service Accounts → Generate new
 * private key).
 */
function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error(
      'Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your environment.',
    );
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

let cachedDb: Firestore | null = null;

/** Get the server-side Firestore instance (Admin SDK — bypasses security rules). */
export function getAdminDb(): Firestore {
  if (cachedDb) return cachedDb;
  cachedDb = getFirestore(getAdminApp());
  return cachedDb;
}

let cachedAuth: Auth | null = null;

/** Get the server-side Auth instance (Admin SDK), used to verify ID tokens. */
export function getAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getAdminApp());
  return cachedAuth;
}

/**
 * The single account allowed to use the admin panel. Must be set via the
 * ADMIN_EMAIL env var — there is deliberately no hardcoded fallback here,
 * so a deployment that forgets to configure it fails closed (nobody gets
 * admin access) instead of silently defaulting to some other account.
 */
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

/**
 * Verifies a Firebase ID token (sent by the client in the Authorization
 * header as `Bearer <token>`) really belongs to the admin account. Every
 * /api/admin/* route must call this before doing anything — never trust a
 * plain email string sent in the request body, since that can be spoofed.
 */
export async function requireAdmin(request: Request): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!ADMIN_EMAIL) {
    return { ok: false, error: 'ADMIN_EMAIL is not configured on the server.', status: 500 };
  }
  const authHeader = request.headers.get('authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    return { ok: false, error: 'Missing admin authorization token.', status: 401 };
  }
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    if (decoded.email !== ADMIN_EMAIL) {
      return { ok: false, error: 'Not authorized.', status: 403 };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Invalid or expired token.', status: 401 };
  }
}
