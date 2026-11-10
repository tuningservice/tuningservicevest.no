-- DRAFT ONLY: schema exported from an empty local journal. No customer rows.
-- Async D1 adapter, concurrency, retention and remote validation are still required.
PRAGMA foreign_keys=ON;

CREATE TABLE chat_mail_attempts(id TEXT PRIMARY KEY,fingerprint TEXT,state TEXT,attempted INTEGER,day TEXT,provider_uuid TEXT,error_code TEXT,next_attempt INTEGER DEFAULT 0);

CREATE TABLE chat_mail_daily(day TEXT PRIMARY KEY,attempts INTEGER);

CREATE TABLE chat_requests(id TEXT PRIMARY KEY,conversation TEXT,fingerprint TEXT,context TEXT,status TEXT,result TEXT);

CREATE TABLE contact_requests(id TEXT PRIMARY KEY,conversation TEXT,fingerprint TEXT,envelope TEXT,mail TEXT,status TEXT);

CREATE TABLE conversations(id TEXT PRIMARY KEY,created TEXT,updated TEXT,epoch INTEGER DEFAULT 0,context TEXT,revision INTEGER DEFAULT 0,bytes INTEGER DEFAULT 0);

CREATE TABLE event_requests(id TEXT PRIMARY KEY,conversation TEXT,fingerprint TEXT,result TEXT);

CREATE TABLE events(seq INTEGER PRIMARY KEY AUTOINCREMENT,conversation TEXT REFERENCES conversations(id),event_id TEXT,at TEXT,epoch INTEGER,kind TEXT,role TEXT,text TEXT,context TEXT,UNIQUE(conversation,event_id));

CREATE TABLE notification_lookups(id TEXT PRIMARY KEY,conversation TEXT,fingerprint TEXT,registration TEXT,started INTEGER,deadline INTEGER,response TEXT);

CREATE TABLE notification_meta(key TEXT PRIMARY KEY,value INTEGER);

CREATE TABLE notification_outbox(id TEXT PRIMARY KEY,kind TEXT,conversation TEXT,revision INTEGER,created INTEGER,status TEXT,attempts INTEGER DEFAULT 0,next_attempt INTEGER,lease_until INTEGER DEFAULT 0,envelope TEXT,mail TEXT,error_code TEXT);

CREATE TABLE notification_receipts(id TEXT PRIMARY KEY,accepted INTEGER);

CREATE TABLE notification_sessions(conversation TEXT PRIMARY KEY,last_activity INTEGER,revision INTEGER,due INTEGER,covered INTEGER DEFAULT 0,ended INTEGER DEFAULT 0);

CREATE TABLE simulated_deliveries(id TEXT PRIMARY KEY,accepted TEXT);

CREATE INDEX notification_due ON notification_outbox(status,next_attempt);
