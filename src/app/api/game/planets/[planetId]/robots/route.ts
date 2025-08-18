import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ planetId: string }> }
) {
  // Get the authorization header
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Unauthorized - Missing or invalid authorization header" },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const { planetId } = await params;

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

  if (!planetId) {
    return NextResponse.json(
      { error: "Planet ID is required" },
      { status: 400 }
    );
  }

  try {
    // ALWAYS use the simple approach since the complex join logic is broken
    // Get all robots first, then filter out active ones manually
    const { data: allRobots, error: simpleError } = await supabase
      .from("user_robots")
      .select("id, current_x, current_y, robot_type_id, robot_types(*)")
      .eq("user_id", user.id)
      .eq("current_planet_id", planetId);

    console.log("🤖 ROBOTS API: Simple query result:", {
      allRobots,
      simpleError,
    });

    if (simpleError) throw simpleError;

    // Filter out robots that are in active groups manually
    const { data: activeGroups } = await supabase
      .from("robot_group_members")
      .select("robot_id, robot_groups!inner(status)")
      .in("robot_groups.status", ["traveling", "exploring", "returning"]);

    const activeRobotIds = activeGroups?.map((g) => g.robot_id) || [];
    const robots =
      allRobots?.filter((robot) => !activeRobotIds.includes(robot.id)) || [];

    console.log("🤖 ROBOTS API: Filtering results:", {
      allRobots: allRobots?.length,
      activeGroups: activeGroups?.length,
      activeRobotIds,
      availableRobots: robots?.length,
    });

    console.log("🤖 ROBOTS API: User ID:", user.id, "Planet ID:", planetId);

    // Transform to expected format
    const robotsResponse = robots?.map((robot, index) => ({
      id: robot.id,
      name: `Robot ${index + 1}`, // Generate name since we don't have a name column
      x: robot.current_x,
      y: robot.current_y,
      robot_types: robot.robot_types, // Match the expected interface
    }));

    return NextResponse.json(robotsResponse || [], { status: 200 });
  } catch (error: any) {
    console.error(`Error fetching robots for planet ${planetId}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
