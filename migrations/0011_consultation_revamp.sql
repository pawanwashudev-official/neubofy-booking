-- Neubofy Multi-Expert Consultation SaaS & Workspace Revamp Migration

-- Add expert profile fields to users table
ALTER TABLE users ADD COLUMN role_title TEXT DEFAULT 'Technology Consultant';
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN session_pricing JSON DEFAULT '[{"duration": 30, "price": 999, "label": "30 Min Strategy Consultation"}, {"duration": 60, "price": 1999, "label": "60 Min Deep Dive"}]';
ALTER TABLE users ADD COLUMN is_free_consultation BOOLEAN DEFAULT 1;

-- Add consultation category & multi-duration to event_types
ALTER TABLE event_types ADD COLUMN category TEXT DEFAULT 'Decide';
ALTER TABLE event_types ADD COLUMN is_free_only BOOLEAN DEFAULT 1;
ALTER TABLE event_types ADD COLUMN durations_json TEXT DEFAULT '[30, 60]';
ALTER TABLE event_types ADD COLUMN icon_name TEXT DEFAULT 'lightbulb';

-- Junction table for assigning multiple experts to an organization consultation event
CREATE TABLE IF NOT EXISTS event_type_members (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    event_type_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    custom_pricing JSON,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_type_id, user_id),
    FOREIGN KEY (event_type_id) REFERENCES event_types(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_etm_event ON event_type_members(event_type_id);
CREATE INDEX IF NOT EXISTS idx_etm_user ON event_type_members(user_id);

-- Add intake questionnaire, phone & payment fields to bookings
ALTER TABLE bookings ADD COLUMN attendee_phone TEXT;
ALTER TABLE bookings ADD COLUMN goal TEXT;
ALTER TABLE bookings ADD COLUMN reason TEXT;
ALTER TABLE bookings ADD COLUMN expectations TEXT;
ALTER TABLE bookings ADD COLUMN duration_minutes INTEGER DEFAULT 30;
ALTER TABLE bookings ADD COLUMN price_amount INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN is_paid BOOLEAN DEFAULT 0;
ALTER TABLE bookings ADD COLUMN email_verified BOOLEAN DEFAULT 1;

-- Email verification challenges table for OTP codes
CREATE TABLE IF NOT EXISTS email_verifications (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    token TEXT UNIQUE,
    expires_at DATETIME NOT NULL,
    verified_at DATETIME,
    attempts INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_verif_email ON email_verifications(email, otp_code);
CREATE INDEX IF NOT EXISTS idx_email_verif_token ON email_verifications(token);
