-- New private test only. No existing local/private records are imported.
CREATE TABLE IF NOT EXISTS cloud_conversations (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0,
 commit_id TEXT NOT NULL, updated INTEGER NOT NULL, expires INTEGER NOT NULL,
 due INTEGER, body TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cloud_conversation_due ON cloud_conversations(due);
CREATE INDEX IF NOT EXISTS cloud_conversation_expiry ON cloud_conversations(expires);
CREATE TABLE IF NOT EXISTS cloud_outbox (
 id TEXT PRIMARY KEY, conversation TEXT NOT NULL REFERENCES cloud_conversations(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, revision INTEGER NOT NULL, mode TEXT NOT NULL, created INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt INTEGER NOT NULL, lease_until INTEGER NOT NULL DEFAULT 0,
 claim TEXT, provider_id TEXT, error_code TEXT, mail TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cloud_outbox_due ON cloud_outbox(status,next_attempt);
CREATE TABLE IF NOT EXISTS cloud_limits (id TEXT PRIMARY KEY, n INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS cloud_budget (id TEXT PRIMARY KEY, reserved INTEGER NOT NULL DEFAULT 0, ceiling INTEGER NOT NULL);
INSERT OR IGNORE INTO cloud_budget(id,ceiling) VALUES('private-test-ai',5000000);
CREATE TABLE IF NOT EXISTS cloud_budget_calls (id TEXT PRIMARY KEY, amount INTEGER NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS cloud_control (id TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO cloud_control VALUES('mail-mode','simulated');
