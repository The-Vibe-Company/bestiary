import { authApiHandler } from '@neondatabase/auth/next/server';
import { NextResponse } from 'next/server';

// When NEON_AUTH_BASE_URL is not configured, return a meaningful error
// instead of crashing the application at startup.
const fallbackHandler = () =>
  NextResponse.json(
    { error: 'Auth service not configured (NEON_AUTH_BASE_URL is missing)' },
    { status: 503 },
  );

const hasAuthUrl = !!process.env.NEON_AUTH_BASE_URL;
const handlers = hasAuthUrl ? authApiHandler() : null;

export const GET = handlers?.GET ?? fallbackHandler;
export const POST = handlers?.POST ?? fallbackHandler;
