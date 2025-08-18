-- Check if alien_types table exists and what alien types are available
SELECT
    'ALIEN TYPES:' as section,
    id,
    name,
    description
FROM alien_types
ORDER BY name;
