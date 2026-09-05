-- ============================================================
-- RPG Game Database Schema (PostgreSQL)
-- Core entities: player, hero, monster, npc, quest, item,
-- resource, building — plus join/instance tables.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- ------------------------------------------------------------
-- PLAYER
-- ------------------------------------------------------------
CREATE TABLE player (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(50) NOT NULL UNIQUE,
    level           INT NOT NULL DEFAULT 1,
    exp             BIGINT NOT NULL DEFAULT 0,
    vip_level       INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at   TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- HERO / CARD (template = static design data)
-- ------------------------------------------------------------
CREATE TABLE hero_template (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    class           VARCHAR(30) NOT NULL,       -- e.g. tank, mage, archer
    rarity          VARCHAR(20) NOT NULL,       -- e.g. common, epic, legendary
    base_hp         INT NOT NULL,
    base_atk        INT NOT NULL,
    base_def        INT NOT NULL,
    growth_curve_id UUID                        -- FK to a stat-growth table if modeled separately
);

-- Player-owned instance of a hero
CREATE TABLE player_hero (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       UUID NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    hero_template_id UUID NOT NULL REFERENCES hero_template(id),
    star_level      INT NOT NULL DEFAULT 1,
    current_level   INT NOT NULL DEFAULT 1,
    acquired_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (player_id, hero_template_id)
);

-- ------------------------------------------------------------
-- MONSTER (combat opponents)
-- ------------------------------------------------------------
CREATE TABLE monster (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    type            VARCHAR(30) NOT NULL,       -- e.g. boss, elite, trash
    combat_tier     INT NOT NULL,
    base_hp         INT NOT NULL,
    base_atk        INT NOT NULL
);

CREATE TABLE monster_drop (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monster_id      UUID NOT NULL REFERENCES monster(id) ON DELETE CASCADE,
    item_template_id UUID,                      -- FK to item_template
    resource_id     UUID,                       -- FK to resource
    drop_rate       NUMERIC(5,4) NOT NULL,       -- 0.0000 - 1.0000
    min_qty         INT NOT NULL DEFAULT 1,
    max_qty         INT NOT NULL DEFAULT 1
);

-- ------------------------------------------------------------
-- NPC (quest givers, shopkeepers, story characters)
-- ------------------------------------------------------------
CREATE TABLE npc (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    role            VARCHAR(30) NOT NULL,       -- e.g. quest_giver, shopkeeper, story
    location_id     UUID                        -- FK to a map/zone table if modeled
);

-- ------------------------------------------------------------
-- QUEST
-- ------------------------------------------------------------
CREATE TABLE quest (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    type            VARCHAR(30) NOT NULL,       -- e.g. main, daily, event
    prerequisite_quest_id UUID REFERENCES quest(id),
    reward_resource_id UUID,                    -- FK to resource
    reward_qty      INT DEFAULT 0
);

CREATE TABLE quest_npc (                        -- which NPC gives which quest (M:N)
    quest_id        UUID NOT NULL REFERENCES quest(id) ON DELETE CASCADE,
    npc_id          UUID NOT NULL REFERENCES npc(id) ON DELETE CASCADE,
    PRIMARY KEY (quest_id, npc_id)
);

CREATE TABLE quest_monster (                    -- which monsters a quest targets (M:N)
    quest_id        UUID NOT NULL REFERENCES quest(id) ON DELETE CASCADE,
    monster_id      UUID NOT NULL REFERENCES monster(id) ON DELETE CASCADE,
    required_kills  INT NOT NULL DEFAULT 1,
    PRIMARY KEY (quest_id, monster_id)
);

CREATE TABLE quest_progress (                   -- player's progress per quest
    player_id       UUID NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    quest_id        UUID NOT NULL REFERENCES quest(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'in_progress', -- in_progress, completed, claimed
    progress_count  INT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (player_id, quest_id)
);

-- ------------------------------------------------------------
-- ITEM / EQUIPMENT (template = static design data)
-- ------------------------------------------------------------
CREATE TABLE item_template (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    slot            VARCHAR(30) NOT NULL,       -- e.g. weapon, armor, accessory
    rarity          VARCHAR(20) NOT NULL,
    base_stats      JSONB NOT NULL DEFAULT '{}' -- flexible stat block
);

-- ------------------------------------------------------------
-- RESOURCE (currencies / materials)
-- ------------------------------------------------------------
CREATE TABLE resource (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(60) NOT NULL,
    currency_type   VARCHAR(30) NOT NULL        -- e.g. gold, gem, upgrade_stone
);

-- ------------------------------------------------------------
-- INVENTORY (join table: player owns items/resources)
-- ------------------------------------------------------------
CREATE TABLE inventory (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       UUID NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    item_template_id UUID REFERENCES item_template(id),
    resource_id     UUID REFERENCES resource(id),
    quantity        INT NOT NULL DEFAULT 1,
    enchant_level   INT NOT NULL DEFAULT 0,
    equipped_to_hero_id UUID REFERENCES player_hero(id),
    acquired_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_inventory_ref CHECK (
        (item_template_id IS NOT NULL AND resource_id IS NULL) OR
        (item_template_id IS NULL AND resource_id IS NOT NULL)
    )
);

-- ------------------------------------------------------------
-- BUILDING
-- ------------------------------------------------------------
CREATE TABLE building (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       UUID NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    building_type   VARCHAR(50) NOT NULL,       -- e.g. farm, barracks, wall
    level           INT NOT NULL DEFAULT 1,
    position_x      INT,
    position_y      INT,
    built_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE building_production (              -- what a building produces over time
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id     UUID NOT NULL REFERENCES building(id) ON DELETE CASCADE,
    resource_id     UUID NOT NULL REFERENCES resource(id),
    rate_per_hour   NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------
-- FORMATION (player's battle lineup of heroes)
-- ------------------------------------------------------------
CREATE TABLE formation (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id       UUID NOT NULL REFERENCES player(id) ON DELETE CASCADE,
    name            VARCHAR(50) NOT NULL DEFAULT 'Default',
    is_active       BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE formation_slot (
    formation_id    UUID NOT NULL REFERENCES formation(id) ON DELETE CASCADE,
    slot_position   INT NOT NULL,               -- e.g. 1-5 grid position
    player_hero_id  UUID NOT NULL REFERENCES player_hero(id) ON DELETE CASCADE,
    PRIMARY KEY (formation_id, slot_position)
);

-- ------------------------------------------------------------
-- Indexes for common lookups
-- ------------------------------------------------------------
CREATE INDEX idx_player_hero_player ON player_hero(player_id);
CREATE INDEX idx_inventory_player ON inventory(player_id);
CREATE INDEX idx_quest_progress_status ON quest_progress(status);
CREATE INDEX idx_building_player ON building(player_id);
CREATE INDEX idx_formation_player ON formation(player_id);
