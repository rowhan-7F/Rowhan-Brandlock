import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareSupabaseClient } from '@/lib/supabase-server';

// ============================================================
//  MIDDLEWARE V2 — Protection par rôle via user_profiles
// ============================================================

// Routes publiques (pas besoin d'être connecté)
const PUBLIC_PATHS = ['/'];
const PUBLIC_PREFIXES = [
  '/approve/',     // pages d'approbation publiques
  '/api/',         // toutes les routes API (auth gérée dans chaque route)
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // === Routes publiques ===
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // === Vérifie la session ===
  const { supabase, response } = await createMiddlewareSupabaseClient(request);
  const { data: { user } } = await supabase.auth.getUser();

  // Pas connecté → redirige vers le login (landing)
  if (!user) {
    const loginUrl = new URL('/', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // === Récupère le profil pour connaître le rôle et le scope ===
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('scope, role, tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile) {
    // User connecté mais sans profil → on déconnecte (cas anormal)
    const loginUrl = new URL('/', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const isSuperAdmin = profile.scope === 'platform' && profile.role === 'super_admin';
  const isTenantAdmin = profile.scope === 'tenant' && profile.role === 'tenant_admin';
  const isGraphist = profile.scope === 'tenant' && profile.role === 'graphist';

  // ============================================================
  //  ROUTING SELON RÔLE
  // ============================================================

  // === /super-admin → super_admin uniquement ===
  if (pathname.startsWith('/super-admin')) {
    if (!isSuperAdmin) {
      // Tenant admin → redirige vers /admin/tenant
      if (isTenantAdmin) {
        return NextResponse.redirect(new URL('/admin/tenant', request.url));
      }
      // Graphiste → redirige vers /studio
      if (isGraphist) {
        return NextResponse.redirect(new URL('/studio', request.url));
      }
      // Sinon → landing
      return NextResponse.redirect(new URL('/', request.url));
    }
    return response;
  }

  // === /admin/tenant → tenant_admin (du tenant) ou super_admin ===
  if (pathname.startsWith('/admin/tenant')) {
    if (!isTenantAdmin && !isSuperAdmin) {
      // Graphiste → redirige vers /studio
      if (isGraphist) {
        return NextResponse.redirect(new URL('/studio', request.url));
      }
      // Sinon → landing
      return NextResponse.redirect(new URL('/', request.url));
    }
    return response;
  }

  // === /studio → graphiste ou tenant_admin (du tenant) ou super_admin ===
  if (pathname.startsWith('/studio')) {
    if (!isGraphist && !isTenantAdmin && !isSuperAdmin) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return response;
  }

  // === Toutes les autres routes : laisser passer si connecté ===
  return response;
}

// Configure sur quelles routes le middleware s'exécute
export const config = {
  matcher: [
    // Match tout sauf les fichiers statiques et les images Next.js
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};