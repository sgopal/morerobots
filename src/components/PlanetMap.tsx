"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import RobotSelectionModal from "./RobotSelectionModal";
import {
  usePlanetLocations,
  usePlanetRobots,
  usePlanetBuildings,
  useStartExploration,
} from "../hooks/useGameQueries";

interface MapCell {
  x: number;
  y: number;
  isExplored: boolean;
  hasResource?: boolean;
  resourceType?: string;
  hasAliens?: boolean;
  alienCount?: number;
  hasBuilding?: boolean;
  buildingType?: string;
}

interface Robot {
  id: string;
  x: number;
  y: number;
  name: string;
}

interface PlanetMapProps {
  planetId: string;
  onLocationClick: (x: number, y: number) => void;
  accessToken: string;
}

export default function PlanetMap({
  planetId,
  onLocationClick,
  accessToken,
}: PlanetMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // exploredCells is now computed via useMemo below
  const [viewportCenter, setViewportCenter] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(20); // pixels per grid cell
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [showRobotModal, setShowRobotModal] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // React Query hooks
  const { data: locations = [] } = usePlanetLocations(planetId, accessToken);
  const { data: robots = [] } = usePlanetRobots(planetId, accessToken);
  const { data: buildings = [] } = usePlanetBuildings(planetId, accessToken);
  const startExplorationMutation = useStartExploration(planetId, accessToken);

  // Constants
  const GRID_SIZE = 32; // cells visible in each direction
  const MIN_ZOOM = 10;
  const MAX_ZOOM = 50;

  // Process React Query data into map cells using useMemo (NO setState!)
  const exploredCells = useMemo(() => {
    const cellMap = new Map<string, MapCell>();

    // Debug: Check what data we're getting
    console.log("🔍 Raw locations data:", locations);
    console.log("🔍 Raw buildings data:", buildings);

    // Process locations first
    locations?.forEach((location: any) => {
      console.log("🔍 Individual Location:", location);
      const key = `${location.x_coord},${location.y_coord}`;
      cellMap.set(key, {
        x: location.x_coord,
        y: location.y_coord,
        isExplored: true,
        hasResource: location.has_resource_mine,
        resourceType: location.resources?.name,
        hasAliens: location.has_aliens,
        alienCount: 0, // Schema doesn't store alien count, only has_aliens boolean
        hasBuilding: false,
      });
    });

    // Add building information
    buildings.forEach((building: any) => {
      const key = `${building.location_x},${building.location_y}`;
      const existing = cellMap.get(key) || {
        x: building.location_x,
        y: building.location_y,
        isExplored: true,
        hasResource: false,
        hasAliens: false,
        hasBuilding: false,
      };
      cellMap.set(key, {
        ...existing,
        hasBuilding: true,
        buildingType: building.building_types?.name,
      });
    });

    console.log(`🗺️ MAP DATA: Processed ${cellMap.size} explored locations`);
    return cellMap;
  }, [locations, buildings]);

  // Convert screen coordinates to grid coordinates
  const screenToGrid = useCallback(
    (screenX: number, screenY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      const canvasX = screenX - rect.left;
      const canvasY = screenY - rect.top;

      const gridX = Math.floor(
        (canvasX - canvas.width / 2) / zoomLevel + viewportCenter.x
      );
      const gridY = Math.floor(
        (canvasY - canvas.height / 2) / zoomLevel + viewportCenter.y
      );

      return { x: gridX, y: gridY };
    },
    [viewportCenter, zoomLevel]
  );

  // Handle canvas click
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (isDragging) return;

      const { x, y } = screenToGrid(event.clientX, event.clientY);
      setSelectedTarget({ x, y });
      setShowRobotModal(true);
    },
    [screenToGrid, isDragging]
  );

  // Handle mouse events for panning
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      setIsDragging(true);
      setLastMousePos({ x: event.clientX, y: event.clientY });
    },
    []
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging) return;

      const deltaX = event.clientX - lastMousePos.x;
      const deltaY = event.clientY - lastMousePos.y;

      setViewportCenter((prev) => ({
        x: prev.x - deltaX / zoomLevel,
        y: prev.y - deltaY / zoomLevel,
      }));

      setLastMousePos({ x: event.clientX, y: event.clientY });
    },
    [isDragging, lastMousePos, zoomLevel]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle zoom
  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -2 : 2;
      setZoomLevel((prev) =>
        Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta))
      );
    },
    []
  );

  // Render map function
  const renderMap = useCallback(
    (canvas: HTMLCanvasElement, cellMap: Map<string, MapCell>) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Calculate visible grid range
      const halfWidth = canvas.width / 2;
      const halfHeight = canvas.height / 2;

      const startX = Math.floor(viewportCenter.x - halfWidth / zoomLevel);
      const endX = Math.floor(viewportCenter.x + halfWidth / zoomLevel);
      const startY = Math.floor(viewportCenter.y - halfHeight / zoomLevel);
      const endY = Math.floor(viewportCenter.y + halfHeight / zoomLevel);

      // Draw grid lines
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 0.5;

      for (let x = startX; x <= endX; x++) {
        const screenX = (x - viewportCenter.x) * zoomLevel + halfWidth;
        ctx.beginPath();
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, canvas.height);
        ctx.stroke();
      }

      for (let y = startY; y <= endY; y++) {
        const screenY = (y - viewportCenter.y) * zoomLevel + halfHeight;
        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(canvas.width, screenY);
        ctx.stroke();
      }

      // Draw cells
      for (let x = startX; x <= endX; x++) {
        for (let y = startY; y <= endY; y++) {
          const key = `${x},${y}`;
          const cell = cellMap.get(key);

          const screenX = (x - viewportCenter.x) * zoomLevel + halfWidth;
          const screenY = (y - viewportCenter.y) * zoomLevel + halfHeight;

          if (cell?.isExplored) {
            // Explored cell
            ctx.fillStyle = "#222";
            ctx.fillRect(screenX, screenY, zoomLevel, zoomLevel);

            // Draw resources
            if (cell.hasResource) {
              ctx.fillStyle = "#4ade80"; // Green for resources
              ctx.fillRect(
                screenX + 2,
                screenY + 2,
                zoomLevel - 4,
                zoomLevel - 4
              );

              if (zoomLevel > 15) {
                ctx.fillStyle = "white";
                ctx.font = `${zoomLevel / 3}px Arial`;
                ctx.textAlign = "center";
                ctx.fillText(
                  "R",
                  screenX + zoomLevel / 2,
                  screenY + zoomLevel / 2 + zoomLevel / 6
                );
              }
            }

            // Draw aliens
            if (cell.hasAliens && cell.alienCount && cell.alienCount > 0) {
              ctx.fillStyle = "#ef4444"; // Red for aliens
              ctx.fillRect(
                screenX + 2,
                screenY + 2,
                zoomLevel - 4,
                zoomLevel - 4
              );

              if (zoomLevel > 15) {
                ctx.fillStyle = "white";
                ctx.font = `${zoomLevel / 3}px Arial`;
                ctx.textAlign = "center";
                ctx.fillText(
                  "A",
                  screenX + zoomLevel / 2,
                  screenY + zoomLevel / 2 + zoomLevel / 6
                );
              }
            }

            // Draw buildings
            if (cell.hasBuilding) {
              ctx.fillStyle = "#8b5cf6"; // Purple for buildings
              ctx.fillRect(
                screenX + 2,
                screenY + 2,
                zoomLevel - 4,
                zoomLevel - 4
              );

              if (zoomLevel > 15) {
                ctx.fillStyle = "white";
                ctx.font = `${zoomLevel / 3}px Arial`;
                ctx.textAlign = "center";
                ctx.fillText(
                  "B",
                  screenX + zoomLevel / 2,
                  screenY + zoomLevel / 2 + zoomLevel / 6
                );
              }
            }
          } else {
            // Fog of war
            ctx.fillStyle = "#111";
            ctx.fillRect(screenX, screenY, zoomLevel, zoomLevel);
          }

          // Draw coordinates for explored cells
          if (cell?.isExplored && zoomLevel > 25) {
            ctx.fillStyle = "#666";
            ctx.font = `${zoomLevel / 4}px Arial`;
            ctx.textAlign = "center";
            ctx.fillText(
              `${x},${y}`,
              screenX + zoomLevel / 2,
              screenY + zoomLevel - 2
            );
          }
        }
      }

      // Draw home base (0,0)
      const homeKey = "0,0";
      if (cellMap.has(homeKey)) {
        const homeScreenX = (0 - viewportCenter.x) * zoomLevel + halfWidth;
        const homeScreenY = (0 - viewportCenter.y) * zoomLevel + halfHeight;

        ctx.strokeStyle = "#fbbf24"; // Yellow border for home
        ctx.lineWidth = 3;
        ctx.strokeRect(homeScreenX, homeScreenY, zoomLevel, zoomLevel);

        if (zoomLevel > 15) {
          ctx.fillStyle = "#fbbf24";
          ctx.font = `${zoomLevel / 3}px Arial`;
          ctx.textAlign = "center";
          ctx.fillText(
            "H",
            homeScreenX + zoomLevel / 2,
            homeScreenY + zoomLevel / 2 + zoomLevel / 6
          );
        }
      }

      // Draw robots
      robots.forEach((robot) => {
        const robotScreenX =
          (robot.x - viewportCenter.x) * zoomLevel + halfWidth;
        const robotScreenY =
          (robot.y - viewportCenter.y) * zoomLevel + halfHeight;

        ctx.fillStyle = "#06b6d4"; // Cyan for robots
        ctx.beginPath();
        ctx.arc(
          robotScreenX + zoomLevel / 2,
          robotScreenY + zoomLevel / 2,
          zoomLevel / 4,
          0,
          2 * Math.PI
        );
        ctx.fill();

        if (zoomLevel > 20) {
          ctx.fillStyle = "white";
          ctx.font = `${zoomLevel / 4}px Arial`;
          ctx.textAlign = "center";
          ctx.fillText(
            robot.name.slice(0, 3),
            robotScreenX + zoomLevel / 2,
            robotScreenY + zoomLevel + 12
          );
        }
      });
    },
    [viewportCenter, zoomLevel, robots]
  );

  // Trigger re-render when viewport/zoom changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderMap(canvas, exploredCells);
  }, [renderMap]);

  // Trigger re-render when exploredCells changes (computed via useMemo)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderMap(canvas, exploredCells);
  }, [exploredCells, renderMap]);

  // Center on home base
  const centerOnHome = useCallback(() => {
    setViewportCenter({ x: 0, y: 0 });
  }, []);

  const handleRobotSelectionConfirm = useCallback(
    async (selectedRobots: string[]) => {
      if (!selectedTarget) return;

      startExplorationMutation.mutate(
        {
          robotIds: selectedRobots,
          targetX: selectedTarget.x,
          targetY: selectedTarget.y,
        },
        {
          onSuccess: () => {
            onLocationClick(selectedTarget.x, selectedTarget.y);
            console.log(
              `🚀 Started exploration to (${selectedTarget.x}, ${selectedTarget.y})`
            );
          },
          onError: (error: Error) => {
            console.error("Error starting exploration:", error);
            alert(`Failed to start exploration: ${error.message}`);
          },
        }
      );
    },
    [selectedTarget, startExplorationMutation, onLocationClick]
  );

  const handleRobotModalClose = useCallback(() => {
    setShowRobotModal(false);
    setSelectedTarget(null);
  }, []);

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden">
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button
          onClick={centerOnHome}
          className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700"
        >
          Home
        </button>
        <button
          onClick={() => setZoomLevel((prev) => Math.min(MAX_ZOOM, prev + 5))}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          +
        </button>
        <button
          onClick={() => setZoomLevel((prev) => Math.max(MIN_ZOOM, prev - 5))}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          -
        </button>
      </div>

      <div className="absolute top-4 right-4 z-10 bg-gray-800 p-2 rounded text-white text-sm">
        <div>Zoom: {zoomLevel}px</div>
        <div>
          Center: ({viewportCenter.x.toFixed(1)}, {viewportCenter.y.toFixed(1)})
        </div>
      </div>

      <div className="absolute bottom-4 left-4 z-10 bg-gray-800 p-2 rounded text-white text-xs">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 bg-yellow-500 border-2 border-yellow-400"></div>
          <span>Home Base</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 bg-green-500"></div>
          <span>Resources</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 bg-red-500"></div>
          <span>Aliens</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 bg-purple-500"></div>
          <span>Buildings</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 bg-cyan-500 rounded-full"></div>
          <span>Robots</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 bg-gray-600"></div>
          <span>Explored Area</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-800 border border-gray-600"></div>
          <span>Fog of War</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="cursor-crosshair"
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {showRobotModal && selectedTarget && (
        <RobotSelectionModal
          isOpen={showRobotModal}
          onClose={handleRobotModalClose}
          onConfirm={handleRobotSelectionConfirm}
          targetX={selectedTarget.x}
          targetY={selectedTarget.y}
          planetId={planetId}
          accessToken={accessToken}
        />
      )}
    </div>
  );
}
