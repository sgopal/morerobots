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

  const { actionId } = await req.json();

  try {
    const { data: activeAction, error: activeActionError } = await supabase
      .from("active_actions")
      .select("*")
      .eq("id", actionId)
      .eq("user_id", user.id)
      .single();

    if (activeActionError || !activeAction) {
      throw new Error(
        activeActionError?.message ||
          "Active action not found or does not belong to user"
      );
    }

    if (activeAction.status === "completed") {
      return NextResponse.json(
        { message: "Action already completed" },
        { status: 200 }
      );
    }

    // Check if the action is actually due for completion
    const currentTime = new Date();
    const endTime = new Date(activeAction.end_time);

    if (currentTime < endTime) {
      return NextResponse.json(
        { message: "Action not yet complete" },
        { status: 200 }
      );
    }

    switch (activeAction.action_type) {
      case "explore": {
        const {
          target_id: robotId,
          target_x: targetX,
          target_y: targetY,
          planet_id: planetId,
        } = activeAction;

        // Update robot's location
        const { error: robotUpdateError } = await supabase
          .from("user_robots")
          .update({
            current_x: targetX,
            current_y: targetY,
            current_planet_id: planetId,
          })
          .eq("id", robotId)
          .eq("user_id", user.id);

        if (robotUpdateError) throw robotUpdateError;

        // Fetch robot's full details including type attributes
        const { data: robotData, error: robotFetchError } = await supabase
          .from("user_robots")
          .select("*, robot_types(*)")
          .eq("id", robotId)
          .eq("user_id", user.id)
          .single();

        if (robotFetchError || !robotData || !robotData.robot_types) {
          throw new Error(
            robotFetchError?.message || "Robot or robot type not found"
          );
        }

        let currentRobotHealth = robotData.robot_types.health; // Assuming full health for now, or fetch from user_robots if storing current HP
        let currentRobotShield = robotData.robot_types.shield; // Same for shield

        // Check for aliens at the target location and handle encounters
        const { data: targetLocation, error: targetLocationError } =
          await supabase
            .from("planet_locations")
            .select(
              "id, has_aliens, alien_type_id, alien_quantity, alien_types(*)"
            )
            .eq("planet_id", planetId)
            .eq("x_coord", targetX)
            .eq("y_coord", targetY)
            .single();

        if (targetLocationError) throw targetLocationError;

        if (
          targetLocation &&
          targetLocation.has_aliens &&
          targetLocation.alien_quantity > 0 &&
          targetLocation.alien_types
        ) {
          let currentAlienHealth = targetLocation.alien_types.health; // Assuming full health for now, or fetch from planet_locations if storing current HP per alien
          let currentAlienShield = targetLocation.alien_types.shield; // Same for shield
          let alienQuantity = targetLocation.alien_quantity;

          console.log(
            `Battle initiated at (${targetX}, ${targetY}) on planet ${planetId} against ${alienQuantity} ${targetLocation.alien_types.name}(s)!`
          );

          // Simple turn-based battle simulation
          while (currentRobotHealth > 0 && alienQuantity > 0) {
            // Robot attacks
            const robotDamage = Math.max(
              0,
              robotData.robot_types.ranged_attack -
                targetLocation.alien_types.ranged_defense
            ); // Simple damage calc
            let damageToAlien = robotDamage;

            if (currentAlienShield > 0) {
              const shieldAbsorbed = Math.min(
                currentAlienShield,
                damageToAlien
              );
              currentAlienShield -= shieldAbsorbed;
              damageToAlien -= shieldAbsorbed;
            }
            if (damageToAlien > 0) {
              currentAlienHealth -= damageToAlien;
            }

            console.log(
              `Robot attacks! Alien shield: ${currentAlienShield.toFixed(
                2
              )}, Alien health: ${currentAlienHealth.toFixed(2)}`
            );

            // Check if alien is defeated
            if (currentAlienHealth <= 0) {
              alienQuantity--;
              console.log(`One alien defeated! Remaining: ${alienQuantity}`);
              if (alienQuantity > 0) {
                // Reset alien health/shield for the next alien in the group
                currentAlienHealth = targetLocation.alien_types.health;
                currentAlienShield = targetLocation.alien_types.shield;
              }
            }

            if (alienQuantity <= 0) {
              console.log("All aliens defeated!");
              break; // All aliens defeated, battle ends
            }

            // Alien attacks (if any remain)
            const alienDamage = Math.max(
              0,
              targetLocation.alien_types.melee_attack -
                robotData.robot_types.melee_defense
            ); // Simple damage calc
            let damageToRobot = alienDamage;

            if (currentRobotShield > 0) {
              const shieldAbsorbed = Math.min(
                currentRobotShield,
                damageToRobot
              );
              currentRobotShield -= shieldAbsorbed;
              damageToRobot -= shieldAbsorbed;
            }
            if (damageToRobot > 0) {
              currentRobotHealth -= damageToRobot;
            }

            console.log(
              `Alien attacks! Robot shield: ${currentRobotShield.toFixed(
                2
              )}, Robot health: ${currentRobotHealth.toFixed(2)}`
            );

            // Apply shield regeneration
            currentRobotShield = Math.min(
              robotData.robot_types.shield,
              currentRobotShield +
                robotData.robot_types.shield_regen_rate_per_second
            );
            currentAlienShield = Math.min(
              targetLocation.alien_types.shield,
              currentAlienShield +
                targetLocation.alien_types.shield_regen_rate_per_second
            );
            console.log(
              `Shields regenerated. Robot shield: ${currentRobotShield.toFixed(
                2
              )}, Alien shield: ${currentAlienShield.toFixed(2)}`
            );

            if (currentRobotHealth <= 0) {
              console.log("Robot defeated!");
              // TODO: Implement robot destruction/respawn logic
              // For now, let's just break out and leave the alien there
              break;
            }
          }

          // Update database based on battle outcome
          if (currentRobotHealth <= 0) {
            // Robot was defeated. Delete the robot.
            const { error: deleteRobotError } = await supabase
              .from("user_robots")
              .delete()
              .eq("id", robotId);
            if (deleteRobotError) throw deleteRobotError;
            console.log(`Robot ${robotId} destroyed!`);
            // The location will still have aliens
          } else if (alienQuantity <= 0) {
            // All aliens defeated. Clear aliens from the location.
            const { error: clearAliensError } = await supabase
              .from("planet_locations")
              .update({
                has_aliens: false,
                alien_type_id: null,
                alien_quantity: 0,
              })
              .eq("id", targetLocation.id);
            if (clearAliensError) throw clearAliensError;
            console.log(
              `Aliens defeated at (${targetX}, ${targetY}) on planet ${planetId}`
            );
          }
        }

        // Reveal planet_location details (e.g., has_resource_mine)
        // This assumes planet_locations are generated on the fly or pre-generated.
        // The actual revelation of content would happen on the client-side
        // when fetching planet_locations for the explored area.

        break;
      }
      case "build_refinery": {
        const {
          target_id: buildingTypeId,
          planet_id: planetId,
          target_x: targetX,
          target_y: targetY,
        } = activeAction;

        // Fetch resource_id from the planet_location to associate with the refinery
        const { data: locationData, error: locationError } = await supabase
          .from("planet_locations")
          .select("resource_id")
          .eq("planet_id", planetId)
          .eq("x_coord", targetX)
          .eq("y_coord", targetY)
          .single();

        if (locationError || !locationData?.resource_id) {
          throw new Error(
            locationError?.message ||
              "Could not find resource at location for refinery"
          );
        }

        const { error: buildingInsertError } = await supabase
          .from("user_buildings")
          .insert({
            user_id: user.id,
            planet_id: planetId,
            location_x: targetX,
            location_y: targetY,
            building_type_id: buildingTypeId,
            producing_resource_id: locationData.resource_id, // Link to the resource found at that location
            production_rate_per_second: 50, // Example production rate, needs balancing
          });

        if (buildingInsertError) throw buildingInsertError;
        break;
      }
      case "build_robot": {
        const { planet_id: planetId } = activeAction;

        const { error: robotInsertError } = await supabase
          .from("user_robots")
          .insert({
            user_id: user.id,
            current_planet_id: planetId,
            current_x: 0, // Robots start at (0,0) of the planet they are built on
            current_y: 0,
            robot_type_id: activeAction.target_id, // Use the robot_type_id from the action
          });

        if (robotInsertError) throw robotInsertError;
        break;
      }
      default:
        console.warn(
          `Unhandled action type on completion: ${activeAction.action_type}`
        );
    }

    // Mark action as completed
    const { error: updateActionError } = await supabase
      .from("active_actions")
      .update({ status: "completed" })
      .eq("id", actionId);

    if (updateActionError) throw updateActionError;

    return NextResponse.json(
      { message: "Action completed successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error completing action:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
