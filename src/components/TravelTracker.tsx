"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface RobotGroup {
  id: string;
  group_name: string;
  start_x: number;
  start_y: number;
  target_x: number;
  target_y: number;
  start_time: string;
  end_time: string;
  status: "traveling" | "exploring" | "returning" | "completed";
  robot_count: number;
  robots: Array<{ id: string; name: string }>;
}

interface TravelTrackerProps {
  planetId: string;
  accessToken: string;
  gameTime: Date;
  onGroupUpdate?: () => void; // Callback to refresh map when groups change
}

export default function TravelTracker({
  planetId,
  accessToken,
  gameTime,
  onGroupUpdate,
}: TravelTrackerProps) {
  const [travelingGroups, setTravelingGroups] = useState<RobotGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousCountRef = useRef(0);

  const fetchTravelingGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Temporarily disable auto-update to debug the issue
      // TODO: Re-enable once we fix the update endpoint
      /*
      try {
        const updateResponse = await fetch("/api/game/explore/update", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        
        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          console.error("Update API error:", errorData);
        }
      } catch (updateErr) {
        console.error("Update API failed:", updateErr);
      }
      */

      // Then fetch current groups
      const response = await fetch(
        `/api/game/explore/groups?planetId=${planetId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (response.ok) {
        const groups = await response.json();
        const previousCount = previousCountRef.current;
        setTravelingGroups(groups);
        previousCountRef.current = groups.length;

        // If group count changed (likely completion), refresh map
        if (previousCount !== groups.length && onGroupUpdate) {
          onGroupUpdate();
        }
      } else {
        const errorData = await response.json();
        setError(
          `Failed to fetch traveling groups: ${
            errorData.error || "Unknown error"
          }`
        );
        console.error("Groups API error:", errorData);
      }
    } catch (err: any) {
      setError(`Error fetching traveling groups: ${err.message}`);
      console.error("Travel tracker error:", err);
    } finally {
      setLoading(false);
    }
  }, [planetId, accessToken, onGroupUpdate]);

  useEffect(() => {
    fetchTravelingGroups();
    // Refresh every 30 seconds - much more reasonable
    const interval = setInterval(fetchTravelingGroups, 30000);
    return () => clearInterval(interval);
  }, [fetchTravelingGroups]);

  const calculatePhaseAndETA = (group: RobotGroup) => {
    const now = gameTime;
    const startTime = new Date(group.start_time);
    const endTime = new Date(group.end_time);

    // Calculate travel phases (assuming equal travel time each way + 30s exploration)
    const totalDuration = endTime.getTime() - startTime.getTime();
    const travelTime = Math.floor((totalDuration - 30000) / 2); // (total - 30s exploration) / 2
    const arrivalTime = new Date(startTime.getTime() + travelTime);
    const explorationEndTime = new Date(arrivalTime.getTime() + 30000);

    let currentPhase = "traveling";
    let etaTime = arrivalTime;
    let etaLabel = "Arrival";

    if (now.getTime() >= explorationEndTime.getTime()) {
      if (now.getTime() >= endTime.getTime()) {
        currentPhase = "completed";
        etaTime = endTime;
        etaLabel = "Returned";
      } else {
        currentPhase = "returning";
        etaTime = endTime;
        etaLabel = "Return Home";
      }
    } else if (now.getTime() >= arrivalTime.getTime()) {
      currentPhase = "exploring";
      etaTime = explorationEndTime;
      etaLabel = "Explore Complete";
    }

    const diffMs = etaTime.getTime() - now.getTime();
    let timeRemaining = "Complete";

    if (diffMs > 0) {
      const diffSeconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(diffSeconds / 60);
      const seconds = diffSeconds % 60;

      if (minutes > 60) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        timeRemaining = `${hours}h ${remainingMinutes}m`;
      } else {
        timeRemaining = `${minutes}m ${seconds}s`;
      }
    }

    return { currentPhase, etaLabel, timeRemaining };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "traveling":
        return "text-blue-400";
      case "exploring":
        return "text-yellow-400";
      case "returning":
        return "text-green-400";
      default:
        return "text-gray-400";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "traveling":
        return "→";
      case "exploring":
        return "🔍";
      case "returning":
        return "←";
      case "completed":
        return "✓";
      default:
        return "?";
    }
  };

  if (loading && travelingGroups.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-2">
          Travel Tracker
        </h3>
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-white">
          Travel Tracker ({travelingGroups.length})
        </h3>
        <button
          onClick={fetchTravelingGroups}
          className="text-sm px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
          disabled={loading}
        >
          {loading ? "..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-red-600 text-white text-sm p-2 rounded mb-3">
          {error}
        </div>
      )}

      {travelingGroups.length === 0 ? (
        <p className="text-gray-400 text-sm">No active expeditions</p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {travelingGroups.map((group) => {
            const { currentPhase, etaLabel, timeRemaining } =
              calculatePhaseAndETA(group);

            return (
              <div
                key={group.id}
                className="bg-gray-700 rounded p-3 border border-gray-600"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-white font-medium">
                      {group.group_name || `Group ${group.id.slice(0, 8)}`}
                    </div>
                    <div className="text-sm text-gray-300">
                      {group.robot_count} robots • ({group.start_x},{" "}
                      {group.start_y}) → ({group.target_x}, {group.target_y})
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-sm font-medium ${getStatusColor(
                        currentPhase
                      )}`}
                    >
                      {getStatusIcon(currentPhase)} {currentPhase.toUpperCase()}
                    </div>
                    <div className="text-sm text-gray-400">
                      {etaLabel}: {timeRemaining}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-gray-400 mb-2">
                  Robots: {group.robots.map((r) => r.name).join(", ")}
                </div>

                {/* Phase indicators */}
                <div className="text-xs text-gray-500 mb-2">
                  <span
                    className={
                      currentPhase === "traveling"
                        ? "text-blue-400"
                        : "text-gray-500"
                    }
                  >
                    Travel
                  </span>
                  {" → "}
                  <span
                    className={
                      currentPhase === "exploring"
                        ? "text-yellow-400"
                        : "text-gray-500"
                    }
                  >
                    Explore
                  </span>
                  {" → "}
                  <span
                    className={
                      currentPhase === "returning"
                        ? "text-green-400"
                        : "text-gray-500"
                    }
                  >
                    Return
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-2">
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-1000"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            ((gameTime.getTime() -
                              new Date(group.start_time).getTime()) /
                              (new Date(group.end_time).getTime() -
                                new Date(group.start_time).getTime())) *
                              100
                          )
                        )}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
