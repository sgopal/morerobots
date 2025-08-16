"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { User } from "@supabase/supabase-js";
import PlanetMap from "../components/PlanetMap";
import GameClock from "../components/GameClock";
import TravelTracker from "../components/TravelTracker";
import RobotPanel from "../components/RobotPanel";

interface Planet {
  id: string;
  name: string;
}

interface UserPlanet {
  planet_id: string;
  planets: Planet; // Assuming the join brings in planet details
}

interface BuildingType {
  name: string;
}

interface UserBuilding {
  id: string;
  building_type_id: string;
  location_x: number;
  location_y: number;
  building_types: BuildingType; // Assuming the join brings in building_type details
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLanded, setHasLanded] = useState(false);
  const [userPlanets, setUserPlanets] = useState<UserPlanet[]>([]);
  const [selectedPlanetId, setSelectedPlanetId] = useState<string | null>(null);
  const [planetBuildings, setPlanetBuildings] = useState<UserBuilding[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [gameTime, setGameTime] = useState<Date>(new Date());
  const router = useRouter();

  // State to hold the Supabase access token
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const fetchUserPlanets = useCallback(
    async (userId: string, token: string) => {
      try {
        const response = await fetch("/api/game/planets", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch user planets");
        }

        if (data && data.length > 0) {
          setHasLanded(true);
          setUserPlanets(data);
        } else {
          setHasLanded(false);
        }
      } catch (err: any) {
        console.error("Error fetching user planets:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [] // Remove state setters from dependencies - they're stable
  );

  const handleInitializeGame = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/game/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initialize game");
      }

      // After initialization, re-fetch user planets
      if (user && accessToken) {
        await fetchUserPlanets(user.id, accessToken);
      }
      alert(
        "Game initialized successfully! You now have a home planet with resources and a robot."
      );
    } catch (err: any) {
      console.error("Error initializing game:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, accessToken, fetchUserPlanets, setError, setLoading]);

  const handleSelectPlanet = useCallback(
    async (planetId: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/game/planets/${planetId}/buildings`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch planet buildings");
        }
        setSelectedPlanetId(planetId);
        setPlanetBuildings(data);
        setShowMap(false); // Hide map when viewing buildings
      } catch (err: any) {
        console.error("Error fetching planet buildings:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [accessToken, setSelectedPlanetId, setPlanetBuildings, setError, setLoading]
  ); // Add dependencies

  const handleShowMap = useCallback((planetId: string) => {
    setSelectedPlanetId(planetId);
    setShowMap(true);
    setPlanetBuildings([]);
  }, []);

  const handleLocationClick = useCallback(
    async (x: number, y: number) => {
      if (!selectedPlanetId || !accessToken) return;

      // For now, let's just trigger an explore action
      // You can expand this to check if there's a robot available, etc.
      console.log(
        `Clicked location: (${x}, ${y}) on planet ${selectedPlanetId}`
      );

      // Location click is now handled by PlanetMap component's robot selection modal
    },
    [selectedPlanetId, accessToken]
  );

  const handleTimeUpdate = useCallback((time: Date) => {
    setGameTime(time);
  }, []);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(
          "Auth state change:",
          event,
          session ? "has session" : "no session"
        );

        if (session) {
          setUser(session.user);
          setAccessToken(session.access_token); // Set the access token
          if (session.user && session.access_token) {
            // Ensure access_token exists here
            await fetchUserPlanets(session.user.id, session.access_token); // Pass token here
          }
        } else if (event === "SIGNED_OUT") {
          // Only redirect on explicit sign out, not on session errors
          setUser(null);
          setAccessToken(null); // Clear access token on logout
          router.push("/auth"); // Redirect to auth page if not logged in
        }
        setLoading(false);
      }
    );

    // Initial check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session && session.user && session.access_token) {
        // Ensure access_token exists here
        setUser(session.user);
        setAccessToken(session.access_token); // Set the access token on initial load
        await fetchUserPlanets(session.user.id, session.access_token); // Pass token here
      } else {
        // Only redirect if we're not already authenticated
        if (!user) {
          router.push("/auth");
        }
      }
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router, fetchUserPlanets]); // Remove user from dependencies to prevent loop

  const handleLogout = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error logging out:", error.message);
      setLoading(false);
    } else {
      setUser(null); // Clear user state immediately
      setAccessToken(null); // Clear access token immediately
      router.push("/auth"); // Ensure redirect
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-900 text-white">
      {user ? (
        <div
          className={`w-full ${
            showMap ? "max-w-6xl" : "max-w-2xl"
          } bg-gray-800 p-8 rounded-lg shadow-lg text-center`}
        >
          <h1 className="text-4xl font-bold mb-4">
            Welcome, {user.email || user.id}!
          </h1>
          <button
            onClick={handleLogout}
            disabled={loading}
            className="mb-8 py-2 px-4 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            {loading ? "Logging out..." : "Logout"}
          </button>

          {error && <p className="text-red-500 mb-4">Error: {error}</p>}

          {!hasLanded ? (
            <div className="mt-8">
              <p className="text-lg mb-4">
                Welcome to MoreRobots! You need to initialize your game to get
                started.
              </p>
              <p className="text-sm mb-6 text-gray-300">
                This will create your home planet with:
                <br />• Your starting robot
                <br />• A resource mine with Iridium
                <br />• A basic refinery
                <br />• Initial resources to begin exploring
              </p>
              <button
                onClick={handleInitializeGame}
                disabled={loading}
                className="py-3 px-6 bg-green-600 text-white rounded-lg text-xl font-semibold hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                {loading ? "Initializing..." : "Initialize Game"}
              </button>
            </div>
          ) : (
            <div>
              {!selectedPlanetId ? (
                <div className="mt-8">
                  <h2 className="text-3xl font-bold mb-6">
                    Your Landed Planets
                  </h2>
                  <ul className="list-none p-0">
                    {userPlanets.map((userPlanet) => (
                      <li
                        key={userPlanet.planet_id}
                        className="mb-3 flex gap-4 items-center justify-center"
                      >
                        <button
                          onClick={() =>
                            handleSelectPlanet(userPlanet.planet_id)
                          }
                          className="text-xl text-blue-400 hover:text-blue-200 focus:outline-none"
                        >
                          {userPlanet.planets.name}
                        </button>
                        <button
                          onClick={() => handleShowMap(userPlanet.planet_id)}
                          className="py-1 px-3 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          View Map
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : showMap ? (
                <div className="mt-8">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold">Planet Map</h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSelectPlanet(selectedPlanetId!)}
                        className="py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        View Buildings
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPlanetId(null);
                          setShowMap(false);
                        }}
                        className="py-2 px-4 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                      >
                        ← Back to Planets
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <div className="lg:col-span-3">
                      {accessToken && (
                        <PlanetMap
                          planetId={selectedPlanetId!}
                          onLocationClick={handleLocationClick}
                          accessToken={accessToken}
                        />
                      )}
                    </div>
                    <div className="space-y-4">
                      <GameClock onTimeUpdate={handleTimeUpdate} />
                      {accessToken && (
                        <RobotPanel
                          planetId={selectedPlanetId!}
                          accessToken={accessToken}
                        />
                      )}
                      {accessToken && (
                        <TravelTracker
                          planetId={selectedPlanetId!}
                          accessToken={accessToken}
                          gameTime={gameTime}
                          onGroupUpdate={() => {
                            // Don't refresh entire page - just log for now
                            console.log(
                              "Group updated - would refresh map here"
                            );
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-8">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold">
                      Buildings on Selected Planet
                    </h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleShowMap(selectedPlanetId!)}
                        className="py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        View Map
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPlanetId(null);
                          setShowMap(false);
                        }}
                        className="py-2 px-4 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                      >
                        ← Back to Planets
                      </button>
                    </div>
                  </div>
                  {planetBuildings.length > 0 ? (
                    <ul className="list-disc list-inside p-0">
                      {planetBuildings.map((building) => (
                        <li key={building.id} className="mb-2 text-lg">
                          {building.building_types.name} at (
                          {building.location_x}, {building.location_y})
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-lg">
                      No buildings found on this planet yet.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </main>
  );
}
