import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from './supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)

  const path = request.nextUrl.pathname

  // 1. If not logged in and trying to access protected dashboards, redirect to login
  if (!user) {
    if (
      path.startsWith('/dashboard') ||
      path.startsWith('/admin') ||
      path.startsWith('/sub-admin')
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // 2. Extract user role from auth metadata
  const role = user.user_metadata?.role

  // 3. Authenticated user redirects
  if (path === '/' || path === '/login') {
    const url = request.nextUrl.clone()
    if (role === 'Admin') {
      url.pathname = '/admin/dashboard'
    } else if (role === 'Sub Admin') {
      url.pathname = '/sub-admin/dashboard'
    } else {
      url.pathname = '/dashboard'
    }
    return NextResponse.redirect(url)
  }

  // 4. Role-based route guards
  if (path.startsWith('/admin') && role !== 'Admin') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (path.startsWith('/sub-admin') && role !== 'Sub Admin') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (path.startsWith('/dashboard') && role !== 'Recovery Officer') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
