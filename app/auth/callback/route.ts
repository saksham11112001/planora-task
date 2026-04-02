import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * OAuth callback handler.
 *
 * After Google OAuth, Supabase redirects to:
 *   /auth/callback?code=xxx&next=/dashboard
 *
 * This route exchanges the code for a session and sets the auth cookie.
 * WITHOUT this route, Google OAuth users are always redirected to login.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Redirect to the intended destination after successful login
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Something went wrong — send back to login with an error message
  return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
}
