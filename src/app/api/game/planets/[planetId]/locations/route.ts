import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ planetId: string }> }
) {
  console.log("🗺️ LOCATIONS API: Starting request");
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
  console.log("🗺️ LOCATIONS API: Got planetId:", planetId);

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
    console.log("🗺️ LOCATIONS API: Auth failed:", userError);
    return NextResponse.json(
      { error: "Unauthorized - Invalid token" },
      { status: 401 }
    );
  }

  console.log("🗺️ LOCATIONS API: Auth success, user:", user.id);

  if (!planetId) {
    return NextResponse.json(
      { error: "Planet ID is required" },
      { status: 400 }
    );
  }

  try {
    console.log("🗺️ LOCATIONS API: Querying locations for planet:", planetId);
    // Get all locations on this planet (no permission check - auth is enough)
    const { data: locations, error } = await supabase
      .from("planet_locations")
      .select("*, resources(*)")
      .eq("planet_id", planetId);

    if (error) {
      console.log("🗺️ LOCATIONS API: Query error:", error);
      throw error;
    }

    console.log(
      "🗺️ LOCATIONS API: Success, found",
      locations?.length || 0,
      "locations"
    );
    return NextResponse.json(locations || [], { status: 200 });
  } catch (error: any) {
    console.error("🗺️ LOCATIONS API: FAILED:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
