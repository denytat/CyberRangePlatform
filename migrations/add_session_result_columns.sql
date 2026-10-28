-- Session result + scenario metadata columns (apply in Supabase if not already present)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS scenario_name VARCHAR(255);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS scenario_description TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS difficulty VARCHAR(10);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS winner_user_id UUID REFERENCES users(id);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS difficulty VARCHAR(10) DEFAULT 'easy';

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
