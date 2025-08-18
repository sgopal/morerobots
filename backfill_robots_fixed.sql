-- Backfill robots for users who don't have any
-- Using the correct Basic Explorer Bot ID: 9a0fc558-2069-401d-8273-1946bde6807a

-- Step 1: Show users who need robots
SELECT 
    'USERS NEEDING ROBOTS:' as info,
    up.user_id,
    up.planet_id
FROM user_planets up
LEFT JOIN user_robots ur ON up.user_id = ur.user_id AND up.planet_id = ur.current_planet_id
WHERE ur.id IS NULL;

-- Step 2: Insert starting robots for users without any
INSERT INTO user_robots (
    user_id, 
    robot_type_id, 
    current_x, 
    current_y, 
    current_planet_id
)
SELECT 
    up.user_id,
    '9a0fc558-2069-401d-8273-1946bde6807a'::uuid as robot_type_id,
    0 as current_x,
    0 as current_y,
    up.planet_id
FROM user_planets up
LEFT JOIN user_robots ur ON up.user_id = ur.user_id AND up.planet_id = ur.current_planet_id
WHERE ur.id IS NULL;

-- Step 3: Verify all users now have robots
SELECT 
    'VERIFICATION:' as info,
    up.user_id,
    up.planet_id,
    COUNT(ur.id) as robot_count
FROM user_planets up
LEFT JOIN user_robots ur ON up.user_id = ur.user_id AND up.planet_id = ur.current_planet_id
GROUP BY up.user_id, up.planet_id
ORDER BY up.user_id;
