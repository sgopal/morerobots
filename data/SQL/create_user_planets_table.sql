CREATE TABLE user_planets (
    user_id UUID NOT NULL,
    planet_id UUID NOT NULL,
    landed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, planet_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (planet_id) REFERENCES planets(id) ON DELETE CASCADE
);
