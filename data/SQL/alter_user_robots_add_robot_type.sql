ALTER TABLE user_robots
ADD COLUMN robot_type_id UUID,
ADD CONSTRAINT fk_robot_type
FOREIGN KEY (robot_type_id) REFERENCES robot_types(id) ON DELETE SET NULL;
