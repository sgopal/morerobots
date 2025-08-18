# Robot Exploration System Logic

## Overview

This document outlines the robot group exploration mechanics for the grid-based world system.

## Core Concepts

### Robot Group Travel

- **Group Formation**: Players can select multiple robots to explore together
- **Speed Calculation**: Groups travel at the speed of the SLOWEST robot in the group
- **Unified Movement**: All robots in a group move together as one unit
- **Destination**: Groups travel to a specific coordinate (x, y) on the planet

### Travel Mechanics

1. **Speed Formula**: `travel_speed_per_grid_point_seconds` from robot_types table
2. **Distance Calculation**: Manhattan distance: `|targetX - currentX| + |targetY - currentY|`
3. **Group Speed**: `Math.max(...robotsInGroup.map(r => r.robot_types.travel_speed_per_grid_point_seconds))`
4. **Travel Time**: `distance * groupSpeed` seconds

### Database Schema

```sql
-- Active group explorations
CREATE TABLE robot_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  planet_id UUID REFERENCES planets(id),
  group_name TEXT,
  start_x INTEGER,
  start_y INTEGER,
  target_x INTEGER,
  target_y INTEGER,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'traveling', -- traveling, exploring, returning, completed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Robots in each group
CREATE TABLE robot_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES robot_groups(id) ON DELETE CASCADE,
  robot_id UUID REFERENCES user_robots(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Game States

1. **Idle**: Robot is at a location, available for new missions
2. **Traveling**: Robot is part of a group moving to destination
3. **Exploring**: Robot has arrived and is exploring the location
4. **Returning**: Robot is traveling back to starting position
5. **Completed**: Mission finished, robot back at original location

### UI Components

- **Robot Selection Modal**: Choose robots and quantities for exploration
- **Travel Tracker**: Shows active groups, progress, and ETAs
- **Game Clock**: Displays current game time and manages time progression

### API Endpoints

- `POST /api/game/explore/start` - Start a group exploration
- `GET /api/game/explore/groups` - Get active traveling groups
- `POST /api/game/explore/complete` - Complete a group exploration
- `GET /api/game/time` - Get current game time

## Implementation Notes

### Time Management

- Game time progresses in real-time (1:1 ratio with real time)
- All timestamps stored in UTC
- Client displays relative times ("arrives in 5 minutes")

### Error Handling

- Validate robot availability before starting missions
- Handle cases where robots are destroyed during travel
- Graceful degradation if API calls fail

### Performance Considerations

- Limit maximum group size (e.g., 10 robots)
- Batch database operations for large groups
- Use efficient queries for travel status updates

### Future Enhancements

- Different exploration types (scout, mine, attack)
- Supply management for long expeditions
- Waypoint-based travel routes
- Formation bonuses for specific robot combinations
