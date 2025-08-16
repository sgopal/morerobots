import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { actionType, robotId, targetX, targetY, buildingTypeId, resourceId, currentPlanetId } = await req.json()

  try {
    switch (actionType) {
      case 'explore': {
        if (!robotId || targetX === undefined || targetY === undefined) {
          return NextResponse.json({ error: 'Missing parameters for explore action' }, { status: 400 })
        }

        // Fetch robot details
        const { data: robot, error: robotError } = await supabase
          .from('user_robots')
          .select('id, current_planet_id, current_x, current_y')
          .eq('id', robotId)
          .eq('user_id', user.id)
          .single()

        if (robotError || !robot) {
          throw new Error(robotError?.message || 'Robot not found or does not belong to user')
        }

        const currentX = robot.current_x;
        const currentY = robot.current_y;

        const distance = Math.abs(targetX - currentX) + Math.abs(targetY - currentY)
        const travelTimeSeconds = distance * 5 // 5 seconds per grid point

        const startTime = new Date()
        const endTime = new Date(startTime.getTime() + travelTimeSeconds * 1000)

        // Record the action in active_actions table
        const { error: activeActionError } = await supabase
          .from('active_actions')
          .insert({
            user_id: user.id,
            action_type: 'explore',
            target_id: robotId, // Storing robotId as target_id for exploration
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            status: 'in_progress',
            target_x: targetX,
            target_y: targetY,
            planet_id: currentPlanetId,
          })

        if (activeActionError) throw activeActionError

        // TODO: Update robot status to 'exploring' and location eventually
        // This will be done in a separate function/trigger when action completes

        return NextResponse.json({ message: 'Exploration initiated', travelTimeSeconds }, { status: 200 })
      }

      case 'build_refinery': {
        if (!buildingTypeId || targetX === undefined || targetY === undefined || !resourceId || !currentPlanetId) {
          return NextResponse.json({ error: 'Missing parameters for build_refinery action' }, { status: 400 })
        }

        // 1. Check if user has required resources (e.g., Iridium for basic refinery)
        // For simplicity, let's assume a fixed cost for now and check user_resources
        const { data: iridiumResource, error: iridiumResourceError } = await supabase
          .from('resources')
          .select('id')
          .eq('name', 'Iridium')
          .single()

        let iridiumId = iridiumResource?.id;

        if (!iridiumId) {
          const { data: newIridium, error: newIridiumError } = await supabase
            .from('resources')
            .insert({ name: 'Iridium', description: 'A rare, shiny metal.' })
            .select('id')
            .single();
          if (newIridiumError) throw newIridiumError;
          iridiumId = newIridium.id;
        }

        const requiredIridium = 100; // Example cost

        const { data: userIridium, error: userIridiumError } = await supabase
          .from('user_resources')
          .select('quantity')
          .eq('user_id', user.id)
          .eq('resource_id', iridiumId)
          .eq('planet_id', currentPlanetId)
          .single()

        if (userIridiumError || (userIridium?.quantity || 0) < requiredIridium) {
          return NextResponse.json({ error: 'Insufficient Iridium to build refinery' }, { status: 400 })
        }

        // 2. Consume resources (reduce iridium from user_resources)
        const { error: consumeError } = await supabase
          .from('user_resources')
          .update({ quantity: userIridium!.quantity - requiredIridium })
          .eq('user_id', user.id)
          .eq('resource_id', iridiumId)
          .eq('planet_id', currentPlanetId)

        if (consumeError) throw consumeError

        // 3. Fetch building type details (for base_crafting_time_seconds)
        const { data: buildingType, error: buildingTypeError } = await supabase
          .from('building_types')
          .select('id, base_crafting_time_seconds')
          .eq('id', buildingTypeId)
          .single()

        if (buildingTypeError || !buildingType) {
          throw new Error(buildingTypeError?.message || 'Building type not found')
        }

        const buildTimeSeconds = buildingType.base_crafting_time_seconds
        const buildStartTime = new Date()
        const buildEndTime = new Date(buildStartTime.getTime() + buildTimeSeconds * 1000)

        // 4. Record the building action in active_actions
        const { error: buildActionError } = await supabase
          .from('active_actions')
          .insert({
            user_id: user.id,
            action_type: 'build_refinery',
            target_id: buildingTypeId, // Storing buildingTypeId as target_id for building
            start_time: buildStartTime.toISOString(),
            end_time: buildEndTime.toISOString(),
            status: 'in_progress',
            // Potentially store target_x, target_y, planet_id here too if needed for completion logic
          })

        if (buildActionError) throw buildActionError

        // 5. Initialize the planet_location if it's a resource mine and not yet recorded
        // We need to ensure the location exists and has the correct resource type
        const { data: locationData, error: locationError } = await supabase
          .from('planet_locations')
          .select('id')
          .eq('planet_id', currentPlanetId)
          .eq('x_coord', targetX)
          .eq('y_coord', targetY)
          .single();

        let locationId = locationData?.id;

        if (!locationId) {
          const { data: newLocation, error: newLocationError } = await supabase
            .from('planet_locations')
            .insert({
              planet_id: currentPlanetId,
              x_coord: targetX,
              y_coord: targetY,
              has_resource_mine: true, // Assuming refinery is built on a mine
              resource_id: resourceId // The resource type of this mine
            })
            .select('id')
            .single();
          if (newLocationError) throw newLocationError;
          locationId = newLocation.id;
        }

        // The actual user_building entry is created when the active_action completes (via trigger/cron)

        return NextResponse.json({ message: 'Refinery construction initiated', buildTimeSeconds }, { status: 200 })
      }

      case 'build_robot': {
        if (!currentPlanetId) {
          return NextResponse.json({ error: 'Missing parameters for build_robot action' }, { status: 400 })
        }

        const { data: iridiumResource, error: iridiumResourceError } = await supabase
          .from('resources')
          .select('id')
          .eq('name', 'Iridium')
          .single()

        let iridiumId = iridiumResource?.id;

        if (iridiumResourceError || !iridiumId) {
          return NextResponse.json({ error: 'Iridium resource not found' }, { status: 500 })
        }

        const requiredIridiumForRobot = 200; // Example cost for a robot

        // Fetch the robot_type_id for 'Basic Explorer Bot'
        const { data: basicRobotType, error: robotTypeFetchError } = await supabase
          .from('robot_types')
          .select('id')
          .eq('name', 'Basic Explorer Bot')
          .single();

        if (robotTypeFetchError || !basicRobotType) {
          return NextResponse.json({ error: 'Basic Explorer Bot type not found' }, { status: 500 });
        }

        const robotTypeId = basicRobotType.id;

        const { data: userIridium, error: userIridiumError } = await supabase
          .from('user_resources')
          .select('quantity')
          .eq('user_id', user.id)
          .eq('resource_id', iridiumId)
          .eq('planet_id', currentPlanetId)
          .single()

        if (userIridiumError || (userIridium?.quantity || 0) < requiredIridiumForRobot) {
          return NextResponse.json({ error: 'Insufficient Iridium to build robot' }, { status: 400 })
        }

        const { error: consumeError } = await supabase
          .from('user_resources')
          .update({ quantity: userIridium!.quantity - requiredIridiumForRobot })
          .eq('user_id', user.id)
          .eq('resource_id', iridiumId)
          .eq('planet_id', currentPlanetId)

        if (consumeError) throw consumeError

        const buildTimeSeconds = 30; // Example build time for a robot
        const buildStartTime = new Date()
        const buildEndTime = new Date(buildStartTime.getTime() + buildTimeSeconds * 1000)

        const { error: buildActionError } = await supabase
          .from('active_actions')
          .insert({
            user_id: user.id,
            action_type: 'build_robot',
            target_id: robotTypeId, // Pass the robot_type_id as target_id
            start_time: buildStartTime.toISOString(),
            end_time: buildEndTime.toISOString(),
            status: 'in_progress',
            planet_id: currentPlanetId,
          })

        if (buildActionError) throw buildActionError

        return NextResponse.json({ message: 'Robot construction initiated', buildTimeSeconds }, { status: 200 })
      }

      default:
        return NextResponse.json({ error: 'Unknown action type' }, { status: 400 })
    }
  } catch (error: any) {
    console.error(`Error performing action ${actionType}:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
