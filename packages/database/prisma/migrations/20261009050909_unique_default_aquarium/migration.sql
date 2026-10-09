CREATE UNIQUE INDEX "Aquarium_one_default_per_owner"
    ON "Aquarium" ("ownerId")
    WHERE "isDefault" = true;