"use client";

import { useState, useEffect } from "react";

interface GameClockProps {
  onTimeUpdate?: (time: Date) => void;
}

export default function GameClock({ onTimeUpdate }: GameClockProps) {
  const [gameTime, setGameTime] = useState<Date>(new Date());
  const [isRunning, setIsRunning] = useState(true);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      const newTime = new Date();
      setGameTime(newTime);
      onTimeUpdate?.(newTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, onTimeUpdate]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const toggleClock = () => {
    setIsRunning(!isRunning);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-white">Game Clock</h3>
        <button
          onClick={toggleClock}
          className={`text-sm px-3 py-1 rounded ${
            isRunning
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}
        >
          {isRunning ? "Pause" : "Resume"}
        </button>
      </div>

      <div className="text-center">
        <div className="text-2xl font-mono text-white mb-1">
          {formatTime(gameTime)}
        </div>
        <div className="text-sm text-gray-400">{formatDate(gameTime)}</div>
      </div>

      <div className="mt-3 text-xs text-gray-500 text-center">
        <div
          className={`inline-flex items-center ${
            isRunning ? "text-green-400" : "text-red-400"
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full mr-2 ${
              isRunning ? "bg-green-400" : "bg-red-400"
            }`}
          ></div>
          {isRunning ? "Time Running" : "Time Paused"}
        </div>
      </div>
    </div>
  );
}
