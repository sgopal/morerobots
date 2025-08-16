"use client";

import { useState, useEffect } from "react";

interface Robot {
  id: string;
  name: string;
  x: number;
  y: number;
  robot_types: {
    name: string;
    travel_speed_per_grid_point_seconds: number;
    health: number;
  };
}

interface RobotSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedRobots: string[]) => void;
  targetX: number;
  targetY: number;
  planetId: string;
  accessToken: string;
}

export default function RobotSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  targetX,
  targetY,
  planetId,
  accessToken,
}: RobotSelectionModalProps) {
  const [availableRobots, setAvailableRobots] = useState<Robot[]>([]);
  const [selectedRobots, setSelectedRobots] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available robots when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAvailableRobots();
    }
  }, [isOpen, planetId, accessToken]);

  const fetchAvailableRobots = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/game/planets/${planetId}/robots`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const robots = await response.json();
        // Filter out robots that are currently traveling or busy
        const availableRobots = robots.filter((robot: Robot) => {
          // TODO: Add logic to check if robot is currently in a traveling group
          return true; // For now, assume all robots are available
        });
        setAvailableRobots(availableRobots);
      } else {
        setError("Failed to fetch robots");
      }
    } catch (err) {
      setError("Error fetching robots");
    } finally {
      setLoading(false);
    }
  };

  // Calculate travel time and group speed
  const calculateTravelStats = () => {
    if (selectedRobots.size === 0) return null;

    const selectedRobotList = availableRobots.filter((robot) =>
      selectedRobots.has(robot.id)
    );

    if (selectedRobotList.length === 0) return null;

    // Calculate distance (Manhattan distance)
    const distance =
      Math.abs(targetX - selectedRobotList[0].x) +
      Math.abs(targetY - selectedRobotList[0].y);

    // Find slowest robot speed (highest travel_speed_per_grid_point_seconds)
    const groupSpeed = Math.max(
      ...selectedRobotList.map(
        (robot) => robot.robot_types.travel_speed_per_grid_point_seconds
      )
    );

    const travelTimeSeconds = distance * groupSpeed;

    return {
      distance,
      groupSpeed,
      travelTimeSeconds,
      robotCount: selectedRobots.size,
    };
  };

  const toggleRobotSelection = (robotId: string) => {
    setSelectedRobots((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(robotId)) {
        newSet.delete(robotId);
      } else {
        newSet.add(robotId);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    if (selectedRobots.size > 0) {
      onConfirm(Array.from(selectedRobots));
      setSelectedRobots(new Set());
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedRobots(new Set());
    setError(null);
    onClose();
  };

  const travelStats = calculateTravelStats();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">
            Send Robots to ({targetX}, {targetY})
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="bg-red-600 text-white p-3 rounded mb-4">{error}</div>
        )}

        {loading ? (
          <div className="text-white text-center py-8">
            Loading available robots...
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">
                Available Robots ({availableRobots.length})
              </h3>
              {availableRobots.length === 0 ? (
                <p className="text-gray-400">
                  No robots available for exploration
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {availableRobots.map((robot) => (
                    <div
                      key={robot.id}
                      className={`p-3 rounded border cursor-pointer transition-colors ${
                        selectedRobots.has(robot.id)
                          ? "bg-blue-600 border-blue-400"
                          : "bg-gray-700 border-gray-600 hover:bg-gray-600"
                      }`}
                      onClick={() => toggleRobotSelection(robot.id)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-white font-medium">
                            {robot.name}
                          </div>
                          <div className="text-sm text-gray-300">
                            {robot.robot_types.name} • Position: ({robot.x},{" "}
                            {robot.y})
                          </div>
                          <div className="text-sm text-gray-400">
                            Speed:{" "}
                            {
                              robot.robot_types
                                .travel_speed_per_grid_point_seconds
                            }
                            s/grid • Health: {robot.robot_types.health}
                          </div>
                        </div>
                        <div className="ml-4">
                          <input
                            type="checkbox"
                            checked={selectedRobots.has(robot.id)}
                            onChange={() => toggleRobotSelection(robot.id)}
                            className="w-5 h-5"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {travelStats && (
              <div className="bg-gray-700 p-4 rounded mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Mission Details
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-300">Selected Robots:</span>
                    <span className="text-white ml-2">
                      {travelStats.robotCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-300">Distance:</span>
                    <span className="text-white ml-2">
                      {travelStats.distance} grid points
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-300">Group Speed:</span>
                    <span className="text-white ml-2">
                      {travelStats.groupSpeed}s per grid point
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-300">Travel Time:</span>
                    <span className="text-white ml-2">
                      {Math.floor(travelStats.travelTimeSeconds / 60)}m{" "}
                      {travelStats.travelTimeSeconds % 60}s
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-2 px-4 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={selectedRobots.size === 0}
                className={`flex-1 py-2 px-4 rounded ${
                  selectedRobots.size > 0
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-600 text-gray-400 cursor-not-allowed"
                }`}
              >
                Send Robots ({selectedRobots.size})
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
