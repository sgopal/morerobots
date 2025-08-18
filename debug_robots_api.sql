-- Debug why users can't see their robots in the API
-- Test the exact queries used by the robots API

-- Replace these with the actual values from the problematic user:
-- USER_ID: ddd31cd3-dd2b-4064-8a36-f6b0e2de6f90 (the user who can't see robots)
-- PLANET_ID: 8ba91c09-899a-4683-ba1c-ad5ca491ab46

-- 1. Test simple query (what the API fallback uses)
SELECT 
    'SIMPLE QUERY:' as test,
    ur.id, 
    ur.current_x, 
    ur.current_y, 
    ur.robot_type_id,
    rt.name as robot_type_name
FROM user_robots ur
JOIN robot_types rt ON ur.robot_type_id = rt.id
WHERE ur.user_id = 'ddd31cd3-dd2b-4064-8a36-f6b0e2de6f90'
  AND ur.current_planet_id = '8ba91c09-899a-4683-ba1c-ad5ca491ab46';

-- 2. Check if robot exists but wrong planet association
SELECT 
    'ALL USER ROBOTS:' as test,
    ur.id,
    ur.user_id,
    ur.current_planet_id,
    ur.current_x,
    ur.current_y,
    rt.name as robot_type_name
FROM user_robots ur
JOIN robot_types rt ON ur.robot_type_id = rt.id
WHERE ur.user_id = 'ddd31cd3-dd2b-4064-8a36-f6b0e2de6f90';

-- 3. Check user's planet associations
SELECT 
    'USER PLANETS:' as test,
    up.user_id,
    up.planet_id,
    p.name as planet_name
FROM user_planets up
JOIN planets p ON up.planet_id = p.id
WHERE up.user_id = 'ddd31cd3-dd2b-4064-8a36-f6b0e2de6f90';

-- 4. Check if there are any active robot groups for this user
SELECT 
    'ACTIVE ROBOT GROUPS:' as test,
    rg.id as group_id,
    rg.status,
    rg.planet_id,
    rgm.robot_id
FROM robot_groups rg
JOIN robot_group_members rgm ON rg.id = rgm.group_id
JOIN user_robots ur ON rgm.robot_id = ur.id
WHERE ur.user_id = 'ddd31cd3-dd2b-4064-8a36-f6b0e2de6f90'
  AND rg.status IN ('traveling', 'exploring', 'returning');

-- 5. Test the complex query (what API tries first)
SELECT 
    'COMPLEX QUERY:' as test,
    ur.id, 
    ur.current_x, 
    ur.current_y, 
    ur.robot_type_id
FROM user_robots ur
LEFT JOIN robot_group_members rgm ON ur.id = rgm.robot_id
LEFT JOIN robot_groups rg ON rgm.group_id = rg.id
WHERE ur.user_id = 'ddd31cd3-dd2b-4064-8a36-f6b0e2de6f90'
  AND ur.current_planet_id = '8ba91c09-899a-4683-ba1c-ad5ca491ab46'
  AND (rg.status IS NULL OR rg.status NOT IN ('traveling', 'exploring', 'returning'));
