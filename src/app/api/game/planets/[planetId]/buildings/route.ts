import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { planetId: string } }) {
  const cookieStore = cookies() // Get the cookie store
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore }) // Pass it as a function
  const { planetId } = params
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!planetId) {
    return NextResponse.json({ error: 'Planet ID is required' }, { status: 400 })
  }

  try {
    const { data: buildings, error } = await supabase
      .from('user_buildings')
      .select('*, building_types(*)') // Select all from user_buildings and join building_types details
      .eq('user_id', user.id)
      .eq('planet_id', planetId)

    if (error) throw error

    return NextResponse.json(buildings, { status: 200 })
  } catch (error: any) {
    console.error(`Error fetching buildings for planet ${planetId}:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
