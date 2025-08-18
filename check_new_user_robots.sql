-- Check robots for the new user account (hello+1@brentlong.net)
-- Replace this with the actual user ID from the server logs

-- First, find the user ID for hello+1@brentlong.net
-- You'll need to look in the server logs for the actual user ID

-- Then check their robots (replace USER_ID_HERE with actual ID):
-- SELECT 
--     'NEW USER ROBOTS:' as info,
--     ur.id,
--     ur.user_id,
--     ur.current_planet_id,
--     ur.current_x,
--     ur.current_y,
--     rt.name as robot_type
-- FROM user_robots ur
-- JOIN robot_types rt ON ur.robot_type_id = rt.id
-- WHERE ur.user_id = 'USER_ID_HERE';

-- Check their planet association:
-- SELECT 
--     'NEW USER PLANETS:' as info,
--     up.user_id,
--     up.planet_id,
--     p.name as planet_name
-- FROM user_planets up
-- JOIN planets p ON up.planet_id = p.id
-- WHERE up.user_id = 'USER_ID_HERE';

-- To find the user ID, look in the server terminal for logs like:
-- "🤖 ROBOTS API: User ID: [SOME_UUID] Planet ID: [SOME_UUID]"
-- Then replace USER_ID_HERE with that UUID and run the queries above
