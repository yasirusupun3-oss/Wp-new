import { NextRequest, NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

/**
 * POST /api/agora-token
 *
 * Generates a real, cryptographically signed Agora RTC token for a given
 * channel, user, and role.
 *
 * Request body:
 *   - channelName: string  (the channel to join)
 *   - uid: string           (unique user identifier)
 *   - role: 'publisher' | 'subscriber'
 *
 * Response:
 *   - token: string         (the RTC token)
 *   - channelName: string
 *   - uid: string
 *
 * Requires these environment variables:
 *   NEXT_PUBLIC_AGORA_APP_ID   (also used by the client — safe to expose)
 *   AGORA_APP_CERTIFICATE      (server-only secret — never expose to the client)
 */

interface AgoraTokenRequest {
  channelName: string;
  uid: string;
  role: 'publisher' | 'subscriber';
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const TOKEN_EXPIRATION_SECONDS = 3600; // 1 hour

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const body: AgoraTokenRequest = await request.json();

    // Validate required fields
    if (!body.channelName || typeof body.channelName !== 'string') {
      return NextResponse.json(
        { error: 'channelName is required and must be a string' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!body.uid || typeof body.uid !== 'string') {
      return NextResponse.json(
        { error: 'uid is required and must be a string' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!body.role || !['publisher', 'subscriber'].includes(body.role)) {
      return NextResponse.json(
        { error: 'role must be either "publisher" or "subscriber"' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Sanitize channel name (alphanumeric, hyphens, underscores only)
    const sanitizedChannel = body.channelName.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!sanitizedChannel) {
      return NextResponse.json(
        { error: 'channelName contains no valid characters' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

    if (!APP_ID || !APP_CERTIFICATE) {
      return NextResponse.json(
        { error: 'Agora is not configured on the server. Set NEXT_PUBLIC_AGORA_APP_ID and AGORA_APP_CERTIFICATE.' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const role = body.role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const expireTime = Math.floor(Date.now() / 1000) + TOKEN_EXPIRATION_SECONDS;

    // Agora numeric uid tokens require a numeric uid. Our client sends either
    // a random numeric string or a Firebase uid (which may be alphanumeric),
    // so we build with the string-uid variant, which accepts both.
    const token = RtcTokenBuilder.buildTokenWithAccount(
      APP_ID,
      APP_CERTIFICATE,
      sanitizedChannel,
      body.uid,
      role,
      expireTime,
    );

    return NextResponse.json(
      {
        token,
        channelName: sanitizedChannel,
        uid: body.uid,
        role: body.role,
        expireTime,
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('[Agora Token API] Error generating token:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error while generating token' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
