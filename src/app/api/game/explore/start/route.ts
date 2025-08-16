import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Get the authorization header
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Unauthorized - Missing or invalid authorization header" },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Create Supabase client with the provided token
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Unauthorized - Invalid token" },
      { status: 401 }
    );
  }

  try {
    const { robotIds, targetX, targetY, planetId } = await req.json();

    if (!robotIds || !Array.isArray(robotIds) || robotIds.length === 0) {
      return NextResponse.json(
        { error: "Robot IDs are required" },
        { status: 400 }
      );
    }

    if (targetX === undefined || targetY === undefined || !planetId) {
      return NextResponse.json(
        { error: "Target coordinates and planet ID are required" },
        { status: 400 }
      );
    }

    // Fetch and validate robots
    const { data: robots, error: robotsError } = await supabase
      .from("user_robots")
      .select("id, current_x, current_y, robot_types(*)")
      .eq("user_id", user.id)
      .eq("current_planet_id", planetId)
      .in("id", robotIds);

    if (robotsError) throw robotsError;

    if (!robots || robots.length !== robotIds.length) {
      return NextResponse.json(
        { error: "Some robots not found or not available" },
        { status: 400 }
      );
    }

    // Calculate travel time based on slowest robot
    const groupSpeed = Math.max(
      ...robots.map(
        (robot) => robot.robot_types.travel_speed_per_grid_point_seconds
      )
    );

    // Use first robot's position as starting point (assuming all robots are at same location)
    const startX = robots[0].current_x;
    const startY = robots[0].current_y;
    const distance = Math.abs(targetX - startX) + Math.abs(targetY - startY);
    const travelTimeSeconds = distance * groupSpeed;

    const startTime = new Date();
    const arrivalTime = new Date(
      startTime.getTime() + travelTimeSeconds * 1000
    );
    const explorationTimeSeconds = 5; // 5 seconds to explore/work
    const returnTravelTime = travelTimeSeconds; // Same time to return
    const totalTimeSeconds =
      travelTimeSeconds + explorationTimeSeconds + returnTravelTime;
    const endTime = new Date(startTime.getTime() + totalTimeSeconds * 1000);

    // Create robot group
    const { data: robotGroup, error: groupError } = await supabase
      .from("robot_groups")
      .insert({
        user_id: user.id,
        planet_id: planetId,
        group_name: `Expedition to (${targetX}, ${targetY})`,
        start_x: startX,
        start_y: startY,
        target_x: targetX,
        target_y: targetY,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: "traveling",
      })
      .select("id")
      .single();

    if (groupError) throw groupError;

    // Add robots to group
    const groupMembers = robotIds.map((robotId: string) => ({
      group_id: robotGroup.id,
      robot_id: robotId,
    }));

    const { error: membersError } = await supabase
      .from("robot_group_members")
      .insert(groupMembers);

    if (membersError) throw membersError;

    // Update robots status to traveling (you might want to add a status field to user_robots table)
    // For now, we'll track status through the robot_groups table

    return NextResponse.json(
      {
        message: "Exploration started successfully",
        groupId: robotGroup.id,
        travelTimeSeconds,
        explorationTimeSeconds,
        totalTimeSeconds,
        phases: {
          travel: arrivalTime.toISOString(),
          exploration: new Date(
            arrivalTime.getTime() + explorationTimeSeconds * 1000
          ).toISOString(),
          return: endTime.toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error starting exploration:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
