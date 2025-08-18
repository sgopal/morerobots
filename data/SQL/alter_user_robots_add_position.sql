-- Add position and planet tracking columns to user_robots table
ALTER TABLE user_robots 
ADD COLUMN IF NOT EXISTS current_x INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_y INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_planet_id UUID;

-- Add foreign key constraint for current_planet_id
ALTER TABLE user_robots 
ADD CONSTRAINT IF NOT EXISTS fk_current_planet 
FOREIGN KEY (current_planet_id) REFERENCES planets(id) ON DELETE SET NULL;

-- Create index for better performance on planet queries
CREATE INDEX IF NOT EXISTS idx_user_robots_planet ON user_robots(user_id, current_planet_id);
CREATE INDEX IF NOT EXISTS idx_user_robots_position ON user_robots(current_planet_id, current_x, current_y);
