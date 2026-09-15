-- ==============================================================================
-- Migration 0002: Hardening Features, Soft Deletes, Pricing Limits & OAuth State
-- ==============================================================================

-- 1. Pricing Limits and Soft Delete on Event Types
ALTER TABLE event_types ADD COLUMN price_min_inr INTEGER DEFAULT 0;
ALTER TABLE event_types ADD COLUMN price_max_inr INTEGER DEFAULT 99999;
ALTER TABLE event_types ADD COLUMN is_deleted BOOLEAN DEFAULT 0;
ALTER TABLE event_types ADD COLUMN deleted_at DATETIME;

-- 2. Calendar Connection Flags and Soft Delete on Users
ALTER TABLE users ADD COLUMN google_calendar_connected BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN outlook_calendar_connected BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN is_deleted BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN deleted_at DATETIME;

-- 3. Soft Delete on Bookings
ALTER TABLE bookings ADD COLUMN is_deleted BOOLEAN DEFAULT 0;
ALTER TABLE bookings ADD COLUMN deleted_at DATETIME;
ALTER TABLE bookings ADD COLUMN deleted_by TEXT;

-- 4. Soft Delete on Coupons
ALTER TABLE coupons ADD COLUMN is_deleted BOOLEAN DEFAULT 0;
ALTER TABLE coupons ADD COLUMN deleted_at DATETIME;

-- 5. Refresh Views to exclude soft-deleted records
DROP VIEW IF EXISTS active_event_types;
CREATE VIEW active_event_types AS
SELECT * FROM event_types WHERE is_active = 1 AND COALESCE(is_deleted, 0) = 0;

DROP VIEW IF EXISTS upcoming_bookings;
CREATE VIEW upcoming_bookings AS
SELECT * FROM bookings 
WHERE status = 'confirmed' 
AND start_time > CURRENT_TIMESTAMP 
AND COALESCE(is_deleted, 0) = 0
ORDER BY start_time;
