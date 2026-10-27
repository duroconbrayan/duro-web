-- Reinicia SOLO las estadísticas de los directos de DURO LIVE (la numeración de directos vuelve a #1).
-- No toca pagos (paypal_payments, proofs, offerwall_*), Monetag, la playlist (requests), artículos ni el planificador.
DELETE FROM session_songs;
DELETE FROM session_action_stats;
DELETE FROM live_viewer_samples;
DELETE FROM gift_alerts;
DELETE FROM live_session_visitors;
DELETE FROM live_likes;
DELETE FROM live_goal_claims;
DELETE FROM live_sessions;
DELETE FROM sqlite_sequence WHERE name IN ('live_sessions','session_songs','session_action_stats','live_viewer_samples','gift_alerts','live_session_visitors','live_likes','live_goal_claims');
