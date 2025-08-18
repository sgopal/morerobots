-- Debug robots for new user: 7cd87277-3c4b-4ff6-8fdc-13fe2dcbf85f
-- Planet ID: 0454f0f6-2bf1-4062-bec2-5ef87eeaf170

-- 1. Simple query: Check if robots exist for the user and planet
SELECT
    'SIMPLE QUERY:' as test,
    id, current_x, current_y, robot_type_id, current_planet_id
FROM user_robots
WHERE user_id = '7cd87277-3c4b-4ff6-8fdc-13fe2dcbf85f'
  AND current_planet_id = '0454f0f6-2bf1-4062-bec2-5ef87eeaf170';

-- 2. All user robots: Check if robot exists but is on a different planet
SELECT
    'ALL USER ROBOTS:' as test,
    id, current_x, current_y, robot_type_id, current_planet_id
FROM user_robots
WHERE user_id = '7cd87277-3c4b-4ff6-8fdc-13fe2dcbf85f';

-- 3. User planets: Verify the user's planet association
SELECT
    'USER PLANETS:' as test,
    user_id, planet_id
FROM user_planets
WHERE user_id = '7cd87277-3c4b-4ff6-8fdc-13fe2dcbf85f';

-- 4. Active robot groups: Check if the robot is currently in a traveling/exploring/returning group
SELECT
    'ACTIVE ROBOT GROUPS:' as test,
    rg.id AS group_id,
    rg.status,
    rgm.robot_id
FROM robot_groups rg
JOIN robot_group_members rgm ON rg.id = rgm.group_id
WHERE rg.user_id = '7cd87277-3c4b-4ff6-8fdc-13fe2dcbf85f'
  AND rg.planet_id = '0454f0f6-2bf1-4062-bec2-5ef87eeaf170'
  AND rg.status IN ('traveling', 'exploring', 'returning');

-- 5. Complex query: Simulate the API's complex query to filter out unavailable robots
SELECT
    'COMPLEX QUERY:' as test,
    ur.id, ur.current_x, ur.current_y, ur.robot_type_id
FROM user_robots ur
LEFT JOIN robot_group_members rgm ON ur.id = rgm.robot_id
LEFT JOIN robot_groups rg ON rgm.group_id = rg.id
WHERE ur.user_id = '7cd87277-3c4b-4ff6-8fdc-13fe2dcbf85f'
  AND ur.current_planet_id = '0454f0f6-2bf1-4062-bec2-5ef87eeaf170'
  AND (rg.status IS NULL OR rg.status NOT IN ('traveling', 'exploring', 'returning'));
