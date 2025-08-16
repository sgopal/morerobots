ALTER TABLE planet_locations
ADD COLUMN alien_type_id UUID,
ADD COLUMN alien_quantity INTEGER NOT NULL DEFAULT 0,
ADD CONSTRAINT fk_alien_type
FOREIGN KEY (alien_type_id) REFERENCES alien_types(id) ON DELETE SET NULL;
