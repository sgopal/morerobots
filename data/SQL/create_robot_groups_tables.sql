-- Create robot groups table for tracking exploration expeditions
CREATE TABLE IF NOT EXISTS robot_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  planet_id UUID REFERENCES planets(id) ON DELETE CASCADE,
  group_name TEXT,
  start_x INTEGER NOT NULL,
  start_y INTEGER NOT NULL,
  target_x INTEGER NOT NULL,
  target_y INTEGER NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'traveling' CHECK (status IN ('traveling', 'exploring', 'returning', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create robot group members table to track which robots are in each group
CREATE TABLE IF NOT EXISTS robot_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES robot_groups(id) ON DELETE CASCADE,
  robot_id UUID REFERENCES user_robots(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, robot_id) -- Prevent duplicate robot assignments to same group
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_robot_groups_user_planet ON robot_groups(user_id, planet_id);
CREATE INDEX IF NOT EXISTS idx_robot_groups_status ON robot_groups(status);
CREATE INDEX IF NOT EXISTS idx_robot_group_members_group ON robot_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_robot_group_members_robot ON robot_group_members(robot_id);

-- Enable RLS (Row Level Security)
ALTER TABLE robot_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE robot_group_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for robot_groups
CREATE POLICY "Users can view their own robot groups" ON robot_groups
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own robot groups" ON robot_groups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own robot groups" ON robot_groups
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own robot groups" ON robot_groups
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for robot_group_members
CREATE POLICY "Users can view their own robot group members" ON robot_group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM robot_groups rg 
      WHERE rg.id = group_id AND rg.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own robot group members" ON robot_group_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM robot_groups rg 
      WHERE rg.id = group_id AND rg.user_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM user_robots ur 
      WHERE ur.id = robot_id AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own robot group members" ON robot_group_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM robot_groups rg 
      WHERE rg.id = group_id AND rg.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own robot group members" ON robot_group_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM robot_groups rg 
      WHERE rg.id = group_id AND rg.user_id = auth.uid()
    )
  );
