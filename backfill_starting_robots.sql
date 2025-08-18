-- Backfill starting robots for users who don't have any
-- This will give every user who has a planet but no robots a starting "Basic Explorer Bot"

-- First, let's see which users need robots
SELECT 
    up.user_id,
    up.planet_id,
    COUNT(ur.id) as robot_count
FROM user_planets up
LEFT JOIN user_robots ur ON up.user_id = ur.user_id AND up.planet_id = ur.current_planet_id
GROUP BY up.user_id, up.planet_id
HAVING COUNT(ur.id) = 0;

-- Get the Basic Explorer Bot type ID
SELECT id, name FROM robot_types WHERE name = 'Basic Explorer Bot';

-- Insert starting robots for users who have planets but no robots
INSERT INTO user_robots (
    user_id, 
    robot_type_id, 
    current_x, 
    current_y, 
    current_planet_id
)
SELECT 
    up.user_id,
    rt.id as robot_type_id,
    0 as current_x,
    0 as current_y,
    up.planet_id
FROM user_planets up
LEFT JOIN user_robots ur ON up.user_id = ur.user_id AND up.planet_id = ur.current_planet_id
CROSS JOIN robot_types rt
WHERE rt.name = 'Basic Explorer Bot'
AND ur.id IS NULL  -- Only for users who don't have robots on this planet
GROUP BY up.user_id, up.planet_id, rt.id;

-- Verify the results
SELECT 
    up.user_id,
    up.planet_id,
    COUNT(ur.id) as robot_count
FROM user_planets up
LEFT JOIN user_robots ur ON up.user_id = ur.user_id AND up.planet_id = ur.current_planet_id
GROUP BY up.user_id, up.planet_id
ORDER BY up.user_id;
