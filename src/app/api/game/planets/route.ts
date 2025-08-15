import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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
    const { data: userPlanets, error } = await supabase
      .from("user_planets")
      .select("*, planets(*)") // Select all from user_planets and join planet details
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json(userPlanets, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching user planets:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
