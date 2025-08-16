import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  console.log("🚀 GROUPS API: Starting request");
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
    console.log("🚀 GROUPS API: Auth failed:", userError);
    return NextResponse.json(
      { error: "Unauthorized - Invalid token" },
      { status: 401 }
    );
  }

  console.log("🚀 GROUPS API: Auth success, user:", user.id);

  try {
    const url = new URL(req.url);
    const planetId = url.searchParams.get("planetId");

    if (!planetId) {
      return NextResponse.json(
        { error: "Planet ID is required" },
        { status: 400 }
      );
    }

    // Fetch active robot groups
    const { data: groups, error: groupsError } = await supabase
      .from("robot_groups")
      .select(
        `
        id,
        group_name,
        start_x,
        start_y,
        target_x,
        target_y,
        start_time,
        end_time,
        status,
        robot_group_members(
          robot_id,
          user_robots(id)
        )
      `
      )
      .eq("user_id", user.id)
      .eq("planet_id", planetId)
      .or(
        `status.neq.completed,and(status.eq.completed,end_time.gte.${new Date(
          Date.now() - 4 * 60 * 60 * 1000
        ).toISOString()})`
      )
      .order("start_time", { ascending: false });

    if (groupsError) throw groupsError;

    // Transform the data to include robot information
    const transformedGroups =
      groups?.map((group) => ({
        id: group.id,
        group_name: group.group_name,
        start_x: group.start_x,
        start_y: group.start_y,
        target_x: group.target_x,
        target_y: group.target_y,
        start_time: group.start_time,
        end_time: group.end_time,
        status: group.status,
        robot_count: group.robot_group_members?.length || 0,
        robots:
          group.robot_group_members?.map((member: any, index: number) => ({
            id: member.user_robots?.id,
            name: `Robot ${index + 1}`, // Generate name since we don't store names
          })) || [],
      })) || [];

    return NextResponse.json(transformedGroups, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching robot groups:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
