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
    const { groupId } = await req.json();

    if (!groupId) {
      return NextResponse.json(
        { error: "Group ID is required" },
        { status: 400 }
      );
    }

    // Fetch the group and verify ownership
    const { data: group, error: groupError } = await supabase
      .from("robot_groups")
      .select(
        `
        id,
        target_x,
        target_y,
        status,
        robot_group_members(
          robot_id,
          user_robots(id, current_x, current_y)
        )
      `
      )
      .eq("id", groupId)
      .eq("user_id", user.id)
      .single();

    if (groupError || !group) {
      return NextResponse.json(
        { error: "Group not found or access denied" },
        { status: 404 }
      );
    }

    if (group.status === "completed") {
      return NextResponse.json(
        { message: "Group already completed" },
        { status: 200 }
      );
    }

    // Update robot positions to target location
    const robotIds =
      group.robot_group_members?.map((member: any) => member.robot_id) || [];

    if (robotIds.length > 0) {
      const { error: updateError } = await supabase
        .from("user_robots")
        .update({
          current_x: group.target_x,
          current_y: group.target_y,
        })
        .in("id", robotIds)
        .eq("user_id", user.id);

      if (updateError) throw updateError;
    }

    // Mark group as completed
    const { error: completeError } = await supabase
      .from("robot_groups")
      .update({ status: "completed" })
      .eq("id", groupId);

    if (completeError) throw completeError;

    // TODO: Handle exploration results
    // - Reveal fog of war at target location
    // - Discover resources, aliens, or other points of interest
    // - Generate exploration rewards
    // - Handle combat if aliens are present

    return NextResponse.json(
      { message: "Exploration completed successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error completing exploration:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
