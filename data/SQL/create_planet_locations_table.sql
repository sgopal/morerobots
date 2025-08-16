CREATE TABLE planet_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    planet_id UUID NOT NULL,
    x_coord INTEGER NOT NULL,
    y_coord INTEGER NOT NULL,
    has_aliens BOOLEAN NOT NULL DEFAULT FALSE,
    has_resource_mine BOOLEAN NOT NULL DEFAULT FALSE,
    resource_id UUID,
    UNIQUE (planet_id, x_coord, y_coord),
    FOREIGN KEY (planet_id) REFERENCES planets(id) ON DELETE CASCADE,
    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE SET NULL
);
