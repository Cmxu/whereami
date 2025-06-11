-- D1 Database Schema for WhereAmI
-- Migration from KV to relational data structure

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT,
    avatar TEXT,
    games_created INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    average_score REAL DEFAULT 0,
    images_uploaded INTEGER DEFAULT 0,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    profile_data TEXT -- JSON field for additional profile data
);

-- Images table
CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    r2_key TEXT NOT NULL UNIQUE,
    location_lat REAL NOT NULL,
    location_lng REAL NOT NULL,
    uploaded_by TEXT NOT NULL REFERENCES users(id),
    uploaded_by_username TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    file_size INTEGER,
    mime_type TEXT,
    is_public BOOLEAN DEFAULT true,
    source_url TEXT,
    tags TEXT, -- JSON array of tags
    metadata TEXT, -- JSON field for additional metadata
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_by_username TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_public BOOLEAN DEFAULT false,
    play_count INTEGER DEFAULT 0,
    rating REAL DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    tags TEXT, -- JSON array of tags
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
    settings TEXT, -- JSON field for game settings
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Game images junction table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS game_images (
    game_id TEXT NOT NULL REFERENCES games(id),
    image_id TEXT NOT NULL REFERENCES images(id),
    order_index INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (game_id, image_id),
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
);

-- Game ratings table
CREATE TABLE IF NOT EXISTS game_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL REFERENCES games(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, user_id),
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Game sessions/scores table
CREATE TABLE IF NOT EXISTS game_sessions (
    id TEXT PRIMARY KEY,
    game_id TEXT REFERENCES games(id),
    game_type TEXT NOT NULL CHECK (game_type IN ('random', 'custom')),
    player_id TEXT REFERENCES users(id),
    player_score INTEGER NOT NULL DEFAULT 0,
    max_possible_score INTEGER NOT NULL DEFAULT 0,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    share_token TEXT UNIQUE,
    is_shared BOOLEAN DEFAULT false,
    rounds_data TEXT NOT NULL, -- JSON array of completed rounds
    game_settings TEXT, -- JSON field for game settings
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL,
    FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Game comments table
CREATE TABLE IF NOT EXISTS game_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL REFERENCES games(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    username TEXT NOT NULL,
    comment TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Share tokens table (for shareable games/sessions)
CREATE TABLE IF NOT EXISTS share_tokens (
    token TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('game', 'session')),
    target_id TEXT NOT NULL, -- game_id or session_id
    created_by TEXT REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 0,
    last_accessed_at DATETIME,
    expires_at DATETIME,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_images_uploaded_by ON images(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_images_is_public ON images(is_public);
CREATE INDEX IF NOT EXISTS idx_images_uploaded_at ON images(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_images_location ON images(location_lat, location_lng);

CREATE INDEX IF NOT EXISTS idx_games_created_by ON games(created_by);
CREATE INDEX IF NOT EXISTS idx_games_is_public ON games(is_public);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);
CREATE INDEX IF NOT EXISTS idx_games_rating ON games(rating);
CREATE INDEX IF NOT EXISTS idx_games_play_count ON games(play_count);

CREATE INDEX IF NOT EXISTS idx_game_images_game_id ON game_images(game_id);
CREATE INDEX IF NOT EXISTS idx_game_images_image_id ON game_images(image_id);
CREATE INDEX IF NOT EXISTS idx_game_images_order ON game_images(game_id, order_index);

CREATE INDEX IF NOT EXISTS idx_game_ratings_game_id ON game_ratings(game_id);
CREATE INDEX IF NOT EXISTS idx_game_ratings_user_id ON game_ratings(user_id);

CREATE INDEX IF NOT EXISTS idx_game_sessions_player_id ON game_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_id ON game_sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_completed_at ON game_sessions(completed_at);
CREATE INDEX IF NOT EXISTS idx_game_sessions_share_token ON game_sessions(share_token);

CREATE INDEX IF NOT EXISTS idx_game_comments_game_id ON game_comments(game_id);
CREATE INDEX IF NOT EXISTS idx_game_comments_user_id ON game_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_share_tokens_target ON share_tokens(type, target_id);
CREATE INDEX IF NOT EXISTS idx_share_tokens_created_by ON share_tokens(created_by); 