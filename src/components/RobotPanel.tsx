"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlanetRobots } from "../hooks/useGameQueries";

interface Robot {
  id: string;
  name: string;
  x: number;
  y: number;
  robot_types: {
    name: string;
    travel_speed_per_grid_point_seconds: number;
    health: number;
    shield: number;
  };
}

interface RobotPanelProps {
  planetId: string;
  accessToken: string;
}

export default function RobotPanel({ planetId, accessToken }: RobotPanelProps) {
  // Use React Query for robots
  const {
    data: robots = [],
    isLoading: loading,
    error,
    refetch: fetchRobots,
  } = usePlanetRobots(planetId, accessToken);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-white">
          Robots on Planet ({robots.length})
        </h3>
        <button
          onClick={fetchRobots}
          className="text-sm px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
          disabled={loading}
        >
          {loading ? "..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-red-600 text-white text-sm p-2 rounded mb-3">
          {error.message}
        </div>
      )}

      {loading && robots.length === 0 ? (
        <p className="text-gray-400 text-sm">Loading robots...</p>
      ) : robots.length === 0 ? (
        <p className="text-gray-400 text-sm">No robots on this planet</p>
      ) : (
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {robots.map((robot) => (
            <div
              key={robot.id}
              className="bg-gray-700 rounded p-2 border border-gray-600"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-white font-medium text-sm">
                    {robot.name}
                  </div>
                  <div className="text-xs text-gray-300">
                    {robot.robot_types?.name || "Unknown Type"}
                  </div>
                  <div className="text-xs text-gray-400">
                    Position: ({robot.x}, {robot.y})
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="text-gray-400">
                    Speed:{" "}
                    {robot.robot_types?.travel_speed_per_grid_point_seconds ||
                      "?"}
                    s/grid
                  </div>
                  <div className="text-gray-400">
                    HP: {robot.robot_types?.health || "?"} / Shield:{" "}
                    {robot.robot_types?.shield || "?"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Debug info */}
      <details className="mt-3">
        <summary className="text-xs text-gray-500 cursor-pointer">
          Debug Info
        </summary>
        <div className="text-xs text-gray-400 mt-1">
          <div>Planet ID: {planetId}</div>
          <div>Robot Count: {robots.length}</div>
          <div>Last Error: {error || "None"}</div>
        </div>
      </details>
    </div>
  );
}
