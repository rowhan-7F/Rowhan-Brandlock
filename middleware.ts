import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareSupabaseClient } from './src/lib/supabase-server';

// Routes publiques : pas besoin d'être connecté
const PUBLIC_PATHS = ['/'];
const PUBLIC_PREFIXES = ['/approve/', '/api/']; // /approve/[id] et toute la route API

const ADMIN_EMAIL = 'admin@rowhan.com';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Laisse passer les routes publiques
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Vérifie la session
  const { supabase, response } = await createMiddlewareSupabaseClient(request);
  const { data: { user } } = await supabase.auth.getUser();

  // Pas connecté → redirige vers le login
  if (!user) {
    const loginUrl = new URL('/', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Connecté mais essaie d'accéder à /admin sans être admin → redirige vers /generate
  if (pathname.startsWith('/admin') && user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.redirect(new URL('/generate', request.url));
  }

  // Connecté en admin mais essaie d'accéder à /generate (page client) → redirige vers /admin
  if (pathname.startsWith('/generate') && user.email?.toLowerCase() === ADMIN_EMAIL) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return response;
}

// Configure sur quelles routes le middleware s'exécute
export const config = {
  matcher: [
    // Match tout sauf les fichiers statiques et les images Next.js
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};