-- Check current state of users and their robots

-- 1. Show all users and their planets
SELECT 
    'USER PLANETS:' as section,
    up.user_id,
    up.planet_id,
    p.name as planet_name
FROM user_planets up
JOIN planets p ON up.planet_id = p.id
ORDER BY up.user_id;

-- 2. Show all robots and their owners
SELECT 
    'USER ROBOTS:' as section,
    ur.id as robot_id,
    ur.user_id,
    ur.current_planet_id,
    ur.current_x,
    ur.current_y,
    rt.name as robot_type
FROM user_robots ur
JOIN robot_types rt ON ur.robot_type_id = rt.id
ORDER BY ur.user_id;

-- 3. Summary: Users and their robot counts
SELECT 
    'SUMMARY:' as section,
    up.user_id,
    up.planet_id,
    COUNT(ur.id) as robot_count,
    CASE 
        WHEN COUNT(ur.id) = 0 THEN 'MISSING ROBOT!'
        ELSE 'HAS ROBOTS'
    END as status
FROM user_planets up
LEFT JOIN user_robots ur ON up.user_id = ur.user_id AND up.planet_id = ur.current_planet_id
GROUP BY up.user_id, up.planet_id
ORDER BY up.user_id;

-- 4. Check if Basic Explorer Bot type exists
SELECT 
    'ROBOT TYPES:' as section,
    id,
    name
FROM robot_types
WHERE name ILIKE '%explorer%' OR name ILIKE '%basic%'
ORDER BY name;

-- 5. Show all robot types to see what's available
SELECT 
    'ALL ROBOT TYPES:' as section,
    id,
    name
FROM robot_types
ORDER BY name;
