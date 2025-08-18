import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { planetId: string } }
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
  const { planetId } = await params

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
    const { data: buildings, error } = await supabase
      .from("user_buildings")
      .select("*, building_types(*)") // Select all from user_buildings and join building_types details
      .eq("user_id", user.id)
      .eq("planet_id", planetId);

    if (error) throw error;

    return NextResponse.json(buildings, { status: 200 });
  } catch (error: any) {
    console.error(`Error fetching buildings for planet ${planetId}:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
