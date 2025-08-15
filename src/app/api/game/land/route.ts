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
    // Check if the user has already landed on any planet
    const { data: userPlanets, error: userPlanetsError } = await supabase
      .from("user_planets")
      .select("*")
      .eq("user_id", user.id);

    if (userPlanetsError) throw userPlanetsError;

    if (userPlanets && userPlanets.length > 0) {
      return NextResponse.json(
        { error: "User has already landed on a planet." },
        { status: 400 }
      );
    }

    // Find a starting planet (or the first available planet if no starting planet is defined)
    const { data: planets, error: planetsError } = await supabase
      .from("planets")
      .select("id")
      .eq("is_starting_planet", true)
      .limit(1);

    if (planetsError) throw planetsError;

    let startingPlanetId: string;

    if (planets && planets.length > 0) {
      startingPlanetId = planets[0].id;
    } else {
      // If no starting planet, get the first available planet
      const { data: anyPlanet, error: anyPlanetError } = await supabase
        .from("planets")
        .select("id")
        .limit(1);
      if (anyPlanetError) throw anyPlanetError;
      if (!anyPlanet || anyPlanet.length === 0) {
        return NextResponse.json(
          {
            error:
              "No planets available to land on. Please seed the planets table.",
          },
          { status: 500 }
        );
      }
      startingPlanetId = anyPlanet[0].id;
    }

    // 1. Record the landing in user_planets
    const { error: insertUserPlanetError } = await supabase
      .from("user_planets")
      .insert({ user_id: user.id, planet_id: startingPlanetId });

    if (insertUserPlanetError) throw insertUserPlanetError;

    // 2. Update the user's current_planet_id
    const { error: updateUserError } = await supabase
      .from("users")
      .update({ current_planet_id: startingPlanetId })
      .eq("id", user.id);

    if (updateUserError) throw updateUserError;

    // 3. Initialize starting resources for the user on this planet
    // For simplicity, let's assume a default resource (e.g., 'basic_material') exists with ID 'resource_uuid_1'
    // You'd ideally fetch resource_ids from your `resources` table.
    const { data: initialResource, error: initialResourceError } =
      await supabase
        .from("resources")
        .select("id")
        .eq("name", "Basic Material")
        .single();

    let resourceId = initialResource?.id; // Assuming 'Basic Material' is seeded

    if (!resourceId) {
      // If 'Basic Material' doesn't exist, create it. This is for initial setup convenience.
      const { data: newResource, error: newResourceError } = await supabase
        .from("resources")
        .insert({
          name: "Basic Material",
          description: "A fundamental crafting material.",
        })
        .select("id")
        .single();
      if (newResourceError) throw newResourceError;
      resourceId = newResource.id;
    }

    const { error: insertUserResourceError } = await supabase
      .from("user_resources")
      .insert({
        user_id: user.id,
        resource_id: resourceId,
        planet_id: startingPlanetId,
        quantity: 500,
      });

    if (insertUserResourceError) throw insertUserResourceError;

    // 4. Initialize starting vehicle (e.g., 'Scout Vehicle')
    const { data: initialVehicleType, error: initialVehicleTypeError } =
      await supabase
        .from("vehicle_types")
        .select("id")
        .eq("name", "Scout Vehicle")
        .single();

    let vehicleTypeId = initialVehicleType?.id;

    if (!vehicleTypeId) {
      const { data: newVehicleType, error: newVehicleTypeError } =
        await supabase
          .from("vehicle_types")
          .insert({
            name: "Scout Vehicle",
            description: "A basic vehicle for exploration.",
            speed: 10,
            resource_capacity: 100,
            base_crafting_time_seconds: 60,
          })
          .select("id")
          .single();
      if (newVehicleTypeError) throw newVehicleTypeError;
      vehicleTypeId = newVehicleType.id;
    }

    const { error: insertUserVehicleError } = await supabase
      .from("user_vehicles")
      .insert({
        user_id: user.id,
        vehicle_type_id: vehicleTypeId,
        current_planet_id: startingPlanetId,
        current_x: 0,
        current_y: 0,
        health: 100,
      });

    if (insertUserVehicleError) throw insertUserVehicleError;

    // 5. Initialize starting building (e.g., 'Basic Refinery')
    const { data: initialBuildingType, error: initialBuildingTypeError } =
      await supabase
        .from("building_types")
        .select("id")
        .eq("name", "Basic Refinery")
        .single();

    let buildingTypeId = initialBuildingType?.id;

    if (!buildingTypeId) {
      const { data: newBuildingType, error: newBuildingTypeError } =
        await supabase
          .from("building_types")
          .insert({
            name: "Basic Refinery",
            description: "Refines raw materials into more useful resources.",
            base_crafting_time_seconds: 180,
            effect_type: "resource_refinement",
            effect_value: 1.2,
          })
          .select("id")
          .single();
      if (newBuildingTypeError) throw newBuildingTypeError;
      buildingTypeId = newBuildingType.id;
    }

    const { error: insertUserBuildingError } = await supabase
      .from("user_buildings")
      .insert({
        user_id: user.id,
        building_type_id: buildingTypeId,
        planet_id: startingPlanetId,
        location_x: 10,
        location_y: 10,
        level: 1,
        is_active: true,
      });

    if (insertUserBuildingError) throw insertUserBuildingError;

    return NextResponse.json(
      {
        message: "Successfully landed on planet!",
        planet_id: startingPlanetId,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error landing on planet:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
