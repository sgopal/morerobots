import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const cookieStore = cookies() // Get the cookie store
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore }) // Pass it as a function
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: userPlanets, error } = await supabase
      .from('user_planets')
      .select('*, planets(*)') // Select all from user_planets and join planet details
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json(userPlanets, { status: 200 })
  } catch (error: any) {
    console.error('Error fetching user planets:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
