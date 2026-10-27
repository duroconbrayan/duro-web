PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE requests (     id INTEGER PRIMARY KEY AUTOINCREMENT,     text TEXT NOT NULL,     status TEXT NOT NULL DEFAULT 'queue',     sort_order INTEGER NOT NULL,     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,     played_at TEXT , play_number INTEGER, username TEXT, tiktok_user_id TEXT, raw_comment TEXT, source TEXT NOT NULL DEFAULT 'manual', room_id TEXT, commented_at TEXT);
CREATE TABLE proofs (     id INTEGER PRIMARY KEY AUTOINCREMENT,     request_id INTEGER NOT NULL,     action TEXT NOT NULL,     proof_key TEXT NOT NULL,     status TEXT NOT NULL DEFAULT 'pending',     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,     reviewed_at TEXT, visitor_id TEXT, session_id INTEGER,     FOREIGN KEY (request_id) REFERENCES requests(id) );
CREATE TABLE action_uses (     id INTEGER PRIMARY KEY AUTOINCREMENT,     visitor_id TEXT NOT NULL,     action TEXT NOT NULL,     request_id INTEGER,     proof_id INTEGER,     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP );
CREATE TABLE paypal_payments (     id INTEGER PRIMARY KEY AUTOINCREMENT,     order_id TEXT NOT NULL,     capture_id TEXT NOT NULL UNIQUE,     request_id INTEGER NOT NULL,     amount TEXT NOT NULL,     currency TEXT NOT NULL,     status TEXT NOT NULL DEFAULT 'completed',     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP );
CREATE TABLE live_sessions (     id INTEGER PRIMARY KEY AUTOINCREMENT,     started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,     ended_at TEXT,     visitors INTEGER NOT NULL DEFAULT 0,     songs_processed INTEGER NOT NULL DEFAULT 0,     proofs_approved INTEGER NOT NULL DEFAULT 0,     paypal_payments INTEGER NOT NULL DEFAULT 0,     paypal_revenue REAL NOT NULL DEFAULT 0,     status TEXT NOT NULL DEFAULT 'active' , tiktok_views INTEGER NOT NULL DEFAULT 0, peak_viewers INTEGER NOT NULL DEFAULT 0, new_followers INTEGER NOT NULL DEFAULT 0, tiktok_gifts_usd REAL NOT NULL DEFAULT 0, other_revenue_usd REAL NOT NULL DEFAULT 0, notes TEXT, avg_viewers REAL NOT NULL DEFAULT 0, tiktok_likes INTEGER NOT NULL DEFAULT 0, tiktok_comments INTEGER NOT NULL DEFAULT 0, tiktok_shares INTEGER NOT NULL DEFAULT 0, tiktok_donors INTEGER NOT NULL DEFAULT 0, tiktok_diamonds INTEGER NOT NULL DEFAULT 0, unique_viewers INTEGER NOT NULL DEFAULT 0, active_viewers INTEGER NOT NULL DEFAULT 0, avg_watch_seconds INTEGER NOT NULL DEFAULT 0);
CREATE TABLE live_session_visitors (     session_id INTEGER NOT NULL,     visitor_id TEXT NOT NULL,     PRIMARY KEY (session_id, visitor_id) );
CREATE TABLE rate_limits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rate_key TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
CREATE TABLE session_songs (     id INTEGER PRIMARY KEY AUTOINCREMENT,     session_id INTEGER NOT NULL,     text TEXT NOT NULL,     created_at DATETIME DEFAULT CURRENT_TIMESTAMP , request_id INTEGER, username TEXT, raw_comment TEXT, source TEXT NOT NULL DEFAULT 'manual', room_id TEXT, commented_at TEXT, tiktok_user_id TEXT);
CREATE TABLE live_likes (     id INTEGER PRIMARY KEY CHECK (id = 1),     total INTEGER NOT NULL DEFAULT 0,     base INTEGER NOT NULL DEFAULT 0,     updated_at TEXT DEFAULT CURRENT_TIMESTAMP , room_id TEXT, top_users TEXT NOT NULL DEFAULT '[]');
CREATE TABLE monetag_daily_stats (     stat_date TEXT NOT NULL PRIMARY KEY,     impressions INTEGER NOT NULL DEFAULT 0,     profit_usd REAL NOT NULL DEFAULT 0,     cpm_usd REAL NOT NULL DEFAULT 0,     imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP );
CREATE TABLE session_action_stats (     session_id INTEGER NOT NULL,     action TEXT NOT NULL,     submitted_count INTEGER NOT NULL DEFAULT 0,     approved_count INTEGER NOT NULL DEFAULT 0,     rejected_count INTEGER NOT NULL DEFAULT 0,     PRIMARY KEY (session_id, action) );
CREATE TABLE gift_alerts (     id INTEGER PRIMARY KEY AUTOINCREMENT,     event_key TEXT NOT NULL UNIQUE,     session_id INTEGER,     username TEXT NOT NULL,     tiktok_user_id TEXT,     gift_id TEXT,     gift_name TEXT NOT NULL,     repeat_count INTEGER NOT NULL DEFAULT 1,     coin_value INTEGER NOT NULL DEFAULT 0,     room_id TEXT,     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP , request_id INTEGER, applied_at TEXT);
CREATE TABLE live_viewer_samples (     id INTEGER PRIMARY KEY AUTOINCREMENT,     sample_key TEXT NOT NULL UNIQUE,     session_id INTEGER,     room_id TEXT,     viewer_count INTEGER NOT NULL,     sampled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP );
CREATE TABLE daily_tasks (     id INTEGER PRIMARY KEY AUTOINCREMENT,     task_date TEXT NOT NULL,     title TEXT NOT NULL,     category TEXT NOT NULL DEFAULT 'general',     planned_time TEXT,     duration_minutes INTEGER NOT NULL DEFAULT 0,     priority INTEGER NOT NULL DEFAULT 2,     status TEXT NOT NULL DEFAULT 'pending',     sort_order INTEGER NOT NULL DEFAULT 0,     notes TEXT,     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,     completed_at TEXT );
CREATE TABLE habits (     id INTEGER PRIMARY KEY AUTOINCREMENT,     name TEXT NOT NULL,     category TEXT NOT NULL DEFAULT 'personal',     target_per_week INTEGER NOT NULL DEFAULT 7,     active INTEGER NOT NULL DEFAULT 1,     sort_order INTEGER NOT NULL DEFAULT 0,     created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP );
CREATE TABLE habit_logs (     id INTEGER PRIMARY KEY AUTOINCREMENT,     habit_id INTEGER NOT NULL,     log_date TEXT NOT NULL,     completed INTEGER NOT NULL DEFAULT 1,     notes TEXT,     completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,     UNIQUE(habit_id, log_date),     FOREIGN KEY(habit_id) REFERENCES habits(id) );
CREATE TABLE articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            excerpt TEXT DEFAULT '',
            content TEXT NOT NULL,
            cover_image TEXT DEFAULT '',
            category TEXT DEFAULT 'Noticias',
            author TEXT DEFAULT 'DURO',
            seo_title TEXT DEFAULT '',
            seo_description TEXT DEFAULT '',
            status TEXT DEFAULT 'draft',
            published_at TEXT,
            updated_at TEXT,
            created_at TEXT NOT NULL
        , cover_width INTEGER, cover_height INTEGER);
CREATE TABLE article_views (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_id INTEGER NOT NULL,
            viewed_at TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'direct'
        );
CREATE TABLE live_goal_claims (     goal_key TEXT PRIMARY KEY,     created_at TEXT DEFAULT CURRENT_TIMESTAMP );
CREATE TABLE offerwall_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id TEXT NOT NULL UNIQUE,
            request_id INTEGER NOT NULL,
            amount_micros INTEGER NOT NULL,
            payout_usd TEXT NOT NULL,
            currency_amount TEXT,
            status TEXT NOT NULL,
            test INTEGER DEFAULT 0,
            signature TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
CREATE TABLE offerwall_balances (
            request_id INTEGER PRIMARY KEY,
            balance_micros INTEGER NOT NULL DEFAULT 0,
            positions_applied INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
DELETE FROM sqlite_sequence;
CREATE UNIQUE INDEX idx_action_uses_visitor_action ON action_uses(visitor_id, action);
CREATE UNIQUE INDEX idx_paypal_order_id ON paypal_payments(order_id);
CREATE INDEX idx_gift_alerts_session ON gift_alerts(session_id);
CREATE INDEX idx_gift_alerts_created ON gift_alerts(created_at);
CREATE INDEX idx_live_viewer_samples_time ON live_viewer_samples(sampled_at);
CREATE INDEX idx_live_viewer_samples_session ON live_viewer_samples(session_id);
CREATE INDEX idx_session_songs_tiktok_user ON session_songs(tiktok_user_id);
CREATE INDEX idx_session_songs_session_user ON session_songs(session_id, tiktok_user_id);
CREATE INDEX idx_daily_tasks_date ON daily_tasks(task_date, sort_order);
CREATE INDEX idx_habit_logs_date ON habit_logs(log_date);
CREATE INDEX idx_habit_logs_habit ON habit_logs(habit_id, log_date);
CREATE INDEX idx_requests_status_sort ON requests(status, sort_order);
CREATE INDEX idx_paypal_request_status ON paypal_payments(request_id, status);
CREATE UNIQUE INDEX idx_pending_proof_visitor_action ON proofs (visitor_id, action) WHERE status = 'pending';
CREATE UNIQUE INDEX idx_paypal_capture_id ON paypal_payments (capture_id);
CREATE UNIQUE INDEX idx_requests_play_number ON requests (play_number) WHERE play_number IS NOT NULL;
CREATE INDEX idx_requests_tiktok_user ON requests (tiktok_user_id, status, id DESC);
CREATE INDEX idx_requests_username_lower ON requests (LOWER(username), status, id DESC);
CREATE INDEX idx_offerwall_transactions_request
        ON offerwall_transactions(request_id)
    ;
