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
    // Check if the user already has a starting planet/setup
    const { data: existingPlanets, error: existingPlanetsError } =
      await supabase.from("user_planets").select("id").eq("user_id", user.id);

    if (existingPlanetsError) throw existingPlanetsError;
    if (existingPlanets && existingPlanets.length > 0) {
      return NextResponse.json(
        { message: "User already initialized" },
        { status: 200 }
      );
    }

    // 1. Create a starting planet for the user
    const { data: newPlanet, error: planetError } = await supabase
      .from("planets")
      .insert({
        name: `Player ${user.id.substring(0, 8)} Home Planet`,
        description: "Your starting world.",
      })
      .select("id")
      .single();

    if (planetError) throw planetError;

    const planetId = newPlanet.id;

    // Link user to the new planet
    const { error: userPlanetError } = await supabase
      .from("user_planets")
      .insert({ user_id: user.id, planet_id: planetId });

    if (userPlanetError) throw userPlanetError;

    // 2. Define starting location (0,0) as an Iridium mine
    const { data: iridiumResource, error: iridiumResourceError } =
      await supabase
        .from("resources")
        .select("id")
        .eq("name", "Iridium")
        .single();

    let iridiumId = iridiumResource?.id;

    if (!iridiumId) {
      const { data: newIridium, error: newIridiumError } = await supabase
        .from("resources")
        .insert({ name: "Iridium", description: "A rare, shiny metal." })
        .select("id")
        .single();
      if (newIridiumError) throw newIridiumError;
      iridiumId = newIridium.id;
    }

    const startingX = 0;
    const startingY = 0;

    const { data: planetLocation, error: planetLocationError } = await supabase
      .from("planet_locations")
      .insert({
        planet_id: planetId,
        x_coord: startingX,
        y_coord: startingY,
        has_resource_mine: true,
        resource_id: iridiumId,
      })
      .select("id")
      .single();

    if (planetLocationError) throw planetLocationError;

    // 3. Create a starting robot for the user at the starting location
    const { data: basicRobotType, error: robotTypeFetchError } = await supabase
      .from("robot_types")
      .select("id")
      .eq("name", "Basic Explorer Bot")
      .single();

    let robotTypeId = basicRobotType?.id;

    if (!robotTypeId) {
      const { data: newRobotType, error: newRobotTypeCreateError } =
        await supabase
          .from("robot_types")
          .insert({
            name: "Basic Explorer Bot",
            description: "A standard robot for initial exploration.",
            health: 100,
            shield: 50,
            ranged_attack: 10,
            melee_attack: 5,
            ranged_defense: 3,
            melee_defense: 2,
            travel_speed_per_grid_point_seconds: 5,
            shield_regen_rate_per_second: 1.0,
          })
          .select("id")
          .single();
      if (newRobotTypeCreateError) throw newRobotTypeCreateError;
      robotTypeId = newRobotType.id;
    }

    const { error: robotError } = await supabase.from("user_robots").insert({
      user_id: user.id,
      current_planet_id: planetId,
      current_x: startingX,
      current_y: startingY,
      name: "Explorer Bot 1",
      robot_type_id: robotTypeId,
    });

    if (robotError) throw robotError;

    // 4. Create a pre-built refinery at the starting location
    const { data: refineryBuildingType, error: buildingTypeError } =
      await supabase
        .from("building_types")
        .select("id")
        .eq("name", "Refinery") // Assuming a building_types table with a 'Refinery' entry
        .single();

    let refineryTypeId = refineryBuildingType?.id;

    if (!refineryTypeId) {
      const { data: newRefineryType, error: newRefineryTypeError } =
        await supabase
          .from("building_types")
          .insert({
            name: "Refinery",
            description: "Produces resources from mines.",
            base_crafting_time_seconds: 10,
          })
          .select("id")
          .single();
      if (newRefineryTypeError) throw newRefineryTypeError;
      refineryTypeId = newRefineryType.id;
    }

    const { error: refineryError } = await supabase
      .from("user_buildings")
      .insert({
        user_id: user.id,
        planet_id: planetId,
        location_x: startingX,
        location_y: startingY,
        building_type_id: refineryTypeId,
        producing_resource_id: iridiumId,
        production_rate_per_second: 50, // Initial balanced production rate
      });

    if (refineryError) throw refineryError;

    // 5. Grant initial Iridium resources to the user
    const { error: initialResourceError } = await supabase
      .from("user_resources")
      .insert({
        user_id: user.id,
        resource_id: iridiumId,
        planet_id: planetId,
        quantity: 500, // Initial balanced iridium quantity
      });

    if (initialResourceError) throw initialResourceError;

    return NextResponse.json(
      { message: "Player initialized successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error initializing player:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
