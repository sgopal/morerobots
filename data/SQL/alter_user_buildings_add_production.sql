ALTER TABLE user_buildings
ADD COLUMN producing_resource_id UUID,
ADD COLUMN production_rate_per_second NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
ADD CONSTRAINT fk_producing_resource
FOREIGN KEY (producing_resource_id) REFERENCES resources(id) ON DELETE SET NULL;
