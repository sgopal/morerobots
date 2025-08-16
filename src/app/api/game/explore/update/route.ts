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
    const now = new Date();

    // Get all active robot groups for this user that need updating
    const { data: groups, error: groupsError } = await supabase
      .from("robot_groups")
      .select(
        `
        id,
        start_time,
        end_time,
        target_x,
        target_y,
        status,
        planet_id,
        robot_group_members(
          robot_id,
          user_robots(id, current_x, current_y)
        )
      `
      )
      .eq("user_id", user.id)
      .in("status", ["traveling", "exploring", "returning"]);

    if (groupsError) throw groupsError;

    const updates = [];

    for (const group of groups || []) {
      const startTime = new Date(group.start_time);
      const endTime = new Date(group.end_time);

      // Calculate phases
      const totalDuration = endTime.getTime() - startTime.getTime();
      const travelTime = Math.floor((totalDuration - 30000) / 2);
      const arrivalTime = new Date(startTime.getTime() + travelTime);
      const explorationEndTime = new Date(arrivalTime.getTime() + 30000);

      let newStatus = group.status;
      let shouldComplete = false;

      // Determine current phase
      if (now >= endTime) {
        // Mission complete - robots return home
        shouldComplete = true;
        newStatus = "completed";
      } else if (now >= explorationEndTime) {
        newStatus = "returning";
      } else if (now >= arrivalTime) {
        newStatus = "exploring";

        // Create discovered location if this is the first time reaching exploring phase
        if (group.status === "traveling") {
          await discoverLocation(
            supabase,
            user.id,
            group.planet_id,
            group.target_x,
            group.target_y
          );
        }
      }

      // Update status if changed
      if (newStatus !== group.status) {
        updates.push({
          id: group.id,
          oldStatus: group.status,
          newStatus,
          shouldComplete,
          robotIds:
            group.robot_group_members?.map((m: any) => m.robot_id) || [],
        });
      }
    }

    // Apply all updates
    for (const update of updates) {
      // Update group status
      await supabase
        .from("robot_groups")
        .update({ status: update.newStatus })
        .eq("id", update.id);

      // If completing, move robots back home
      if (update.shouldComplete && update.robotIds.length > 0) {
        await supabase
          .from("user_robots")
          .update({
            current_x: 0,
            current_y: 0,
          })
          .in("id", update.robotIds)
          .eq("user_id", user.id);
      }
    }

    return NextResponse.json(
      {
        message: "Groups updated successfully",
        updatedGroups: updates.length,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating exploration groups:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function discoverLocation(
  supabase: any,
  userId: string,
  planetId: string,
  x: number,
  y: number
) {
  // Check if location already exists
  const { data: existing } = await supabase
    .from("planet_locations")
    .select("id")
    .eq("planet_id", planetId)
    .eq("x_coord", x)
    .eq("y_coord", y)
    .single();

  if (existing) return; // Location already discovered

  // Generate random discovery
  const discoveries = [
    {
      hasResource: true,
      resourceName: "Iron",
      resourceDesc: "Common metal ore",
    },
    {
      hasResource: true,
      resourceName: "Copper",
      resourceDesc: "Useful for electronics",
    },
    {
      hasResource: true,
      resourceName: "Silicon",
      resourceDesc: "Essential for computers",
    },
    { hasAliens: true, alienCount: Math.floor(Math.random() * 5) + 1 },
    { isEmpty: true }, // Empty location
  ];

  const discovery = discoveries[Math.floor(Math.random() * discoveries.length)];

  let resourceId = null;

  // Create resource if needed
  if (discovery.hasResource) {
    // Try to find existing resource
    const { data: resource } = await supabase
      .from("resources")
      .select("id")
      .eq("name", discovery.resourceName)
      .single();

    if (resource) {
      resourceId = resource.id;
    } else {
      // Create new resource
      const { data: newResource } = await supabase
        .from("resources")
        .insert({
          name: discovery.resourceName,
          description: discovery.resourceDesc,
        })
        .select("id")
        .single();
      resourceId = newResource?.id;
    }
  }

  // Create the discovered location
  await supabase.from("planet_locations").insert({
    planet_id: planetId,
    x_coord: x,
    y_coord: y,
    has_resource_mine: !!discovery.hasResource,
    resource_id: resourceId,
    has_aliens: !!discovery.hasAliens,
    alien_quantity: discovery.alienCount || 0,
  });
}
