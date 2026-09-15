-- ==============================================================================
-- Neubofy Consultation & Booking Platform - Master Consolidated Migration (0001)
-- ==============================================================================
-- This script resets and provisions the complete database schema from scratch.
-- To run on local D1:
--   npx wrangler d1 execute neubofy-booking-db --local --file=./migrations/0001_initial_schema.sql
-- To run on remote Cloudflare production D1:
--   npx wrangler d1 execute neubofy-booking-db --remote --file=./migrations/0001_initial_schema.sql
-- ==============================================================================

-- 1. Drop existing views and tables in reverse dependency order
DROP VIEW IF EXISTS active_event_types;
DROP VIEW IF EXISTS upcoming_bookings;

DROP TABLE IF EXISTS scheduled_emails;
DROP TABLE IF EXISTS reschedule_proposals;
DROP TABLE IF EXISTS email_templates;
DROP TABLE IF EXISTS email_verifications;
DROP TABLE IF EXISTS coupons;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS date_overrides;
DROP TABLE IF EXISTS availability_overrides;
DROP TABLE IF EXISTS availability_rules;
DROP TABLE IF EXISTS event_type_members;
DROP TABLE IF EXISTS event_types;
DROP TABLE IF EXISTS organization_invitations;
DROP TABLE IF EXISTS organization_members;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS webhooks;
DROP TABLE IF EXISTS api_usage;
DROP TABLE IF EXISTS cache_control;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS organizations;

-- 2. Organizations table
CREATE TABLE organizations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    profile_image TEXT,
    brand_color TEXT DEFAULT '#3b82f6',
    timezone TEXT DEFAULT 'Asia/Kolkata',
    contact_email TEXT,
    reply_to_email TEXT,
    email_from TEXT,
    setup_complete BOOLEAN DEFAULT 1,
    settings JSON DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_organizations_slug ON organizations(slug);

-- 3. Users table (Admins and Member Experts)
CREATE TABLE users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    profile_image TEXT,
    brand_color TEXT DEFAULT '#3b82f6',
    timezone TEXT DEFAULT 'Asia/Kolkata',
    contact_email TEXT,
    role_title TEXT DEFAULT 'Technology Consultant',
    bio TEXT,
    phone TEXT,
    session_pricing JSON DEFAULT '[{"duration": 30, "price": 999, "label": "30 Min Strategy Consultation"}, {"duration": 60, "price": 1999, "label": "60 Min Deep Dive"}]',
    is_free_consultation BOOLEAN DEFAULT 1,
    is_active BOOLEAN DEFAULT 1,
    google_refresh_token TEXT,
    outlook_refresh_token TEXT,
    sync_token TEXT,
    last_sync DATETIME,
    settings JSON DEFAULT '{}',
    last_login_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_slug ON users(slug);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);

-- 4. Organization memberships (RBAC: owner, admin, member)
CREATE TABLE organization_members (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    is_active BOOLEAN DEFAULT 1,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, user_id),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id, is_active);

-- 5. Organization invitations
CREATE TABLE organization_invitations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    invited_by TEXT NOT NULL,
    token_digest TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    accepted_at DATETIME,
    revoked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_org_invitations_email ON organization_invitations(organization_id, email, expires_at);
CREATE INDEX idx_org_invitations_token ON organization_invitations(token_digest);

-- 6. Event types (Organization Consultation Services)
CREATE TABLE event_types (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT NOT NULL,
    user_id TEXT, -- Legacy creator/lead user
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    buffer_minutes INTEGER DEFAULT 0,
    color TEXT DEFAULT '#3b82f6',
    description TEXT,
    category TEXT DEFAULT 'Decide', -- Decide, Implement, Improve, Protect & Verify, Operate
    is_free_only BOOLEAN DEFAULT 1, -- 1 = Complimentary (100% Free), 0 = Paid consultation
    price_inr INTEGER DEFAULT 0, -- Base price in INR
    durations_json TEXT DEFAULT '[30, 60]', -- Supported duration options in minutes
    icon_name TEXT DEFAULT 'lightbulb',
    location_type TEXT DEFAULT 'google_meet',
    location_details TEXT,
    is_active BOOLEAN DEFAULT 1,
    cover_image TEXT,
    availability_calendars TEXT DEFAULT 'google',
    invite_calendar TEXT DEFAULT 'google',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(organization_id, slug)
);

CREATE INDEX idx_event_types_org ON event_types(organization_id, is_active);
CREATE INDEX idx_event_types_slug ON event_types(slug);
CREATE INDEX idx_event_types_user ON event_types(user_id);

-- 7. Junction table for assigning multiple experts to an organization consultation event
CREATE TABLE event_type_members (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    event_type_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    custom_pricing JSON, -- Optional custom duration & pricing packages override
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_type_id, user_id),
    FOREIGN KEY (event_type_id) REFERENCES event_types(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_etm_event ON event_type_members(event_type_id);
CREATE INDEX idx_etm_user ON event_type_members(user_id);

-- 8. Availability rules (Weekly recurring hours per expert)
CREATE TABLE availability_rules (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    organization_id TEXT,
    event_type_id TEXT,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 6 = Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (event_type_id) REFERENCES event_types(id) ON DELETE CASCADE
);

CREATE INDEX idx_availability_rules_user ON availability_rules(user_id, is_active);

-- 9. Availability overrides (Specific date exceptions per expert)
CREATE TABLE availability_overrides (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    organization_id TEXT,
    date DATE NOT NULL,
    available BOOLEAN NOT NULL,
    start_time TIME,
    end_time TIME,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_availability_overrides_user_date ON availability_overrides(user_id, date);

-- 10. Bookings table
CREATE TABLE bookings (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT NOT NULL,
    event_type_id TEXT NOT NULL,
    user_id TEXT NOT NULL, -- Assigned expert host
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    attendee_name TEXT NOT NULL,
    attendee_email TEXT NOT NULL,
    attendee_phone TEXT,
    attendee_notes TEXT,
    goal TEXT,
    reason TEXT,
    expectations TEXT,
    price_amount INTEGER DEFAULT 0, -- Final price charged in INR
    discount_amount INTEGER DEFAULT 0, -- Applied discount in INR
    coupon_code TEXT, -- Applied promo/waiver coupon
    is_paid BOOLEAN DEFAULT 1, -- 1 for complimentary or paid bookings
    email_verified BOOLEAN DEFAULT 1,
    client_firebase_uid TEXT,
    google_event_id TEXT,
    outlook_event_id TEXT,
    meeting_url TEXT,
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'canceled', 'rescheduled')),
    canceled_at DATETIME,
    canceled_by TEXT CHECK (canceled_by IN ('host', 'attendee')),
    cancellation_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (event_type_id) REFERENCES event_types(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_bookings_user_time ON bookings(user_id, start_time);
CREATE INDEX idx_bookings_org ON bookings(organization_id, status);
CREATE INDEX idx_bookings_event_type ON bookings(event_type_id);
CREATE INDEX idx_bookings_status ON bookings(status);

-- 11. Promotional Coupons & Complimentary Waivers
CREATE TABLE coupons (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT NOT NULL DEFAULT 'org_neubofy_main',
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value INTEGER NOT NULL, -- 100 for 100% off (complimentary), or fixed INR amount
    event_type_id TEXT, -- NULL means applicable to all consultation services
    max_uses INTEGER, -- NULL = unlimited
    used_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    expires_at DATETIME,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (event_type_id) REFERENCES event_types(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_org ON coupons(organization_id, is_active);

-- 12. Email OTP verification challenges
CREATE TABLE email_verifications (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    token TEXT UNIQUE,
    expires_at DATETIME NOT NULL,
    verified_at DATETIME,
    attempts INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_verif_email ON email_verifications(email, otp_code);
CREATE INDEX idx_email_verif_token ON email_verifications(token);

-- 13. Email templates & custom notifications
CREATE TABLE email_templates (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL DEFAULT 'org_neubofy_main',
    template_type TEXT NOT NULL CHECK (template_type IN ('confirmation', 'cancellation', 'reschedule', 'reminder_24h', 'reminder_1h', 'reminder_30m')),
    is_enabled BOOLEAN DEFAULT 1,
    subject TEXT,
    custom_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, template_type)
);

CREATE INDEX idx_email_templates_user ON email_templates(user_id);

-- 14. Scheduled emails for reminders
CREATE TABLE scheduled_emails (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    booking_id TEXT NOT NULL,
    template_type TEXT NOT NULL,
    scheduled_for DATETIME NOT NULL,
    sent_at DATETIME,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE INDEX idx_scheduled_emails_pending ON scheduled_emails(status, scheduled_for);
CREATE INDEX idx_scheduled_emails_booking ON scheduled_emails(booking_id);

-- 15. Host reschedule proposals
CREATE TABLE reschedule_proposals (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    booking_id TEXT NOT NULL,
    proposed_start_time DATETIME NOT NULL,
    proposed_end_time DATETIME NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'counter_proposed', 'expired')),
    proposed_by TEXT NOT NULL CHECK (proposed_by IN ('host', 'attendee')),
    response_token TEXT UNIQUE NOT NULL,
    responded_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE INDEX idx_reschedule_proposals_booking ON reschedule_proposals(booking_id);
CREATE INDEX idx_reschedule_proposals_token ON reschedule_proposals(response_token);

-- 16. Auth sessions and tokens
CREATE TABLE sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- 17. Views for common queries
CREATE VIEW active_event_types AS
SELECT * FROM event_types WHERE is_active = 1;

CREATE VIEW upcoming_bookings AS
SELECT * FROM bookings 
WHERE status = 'confirmed' 
AND start_time > CURRENT_TIMESTAMP 
ORDER BY start_time;

-- ==============================================================================
-- INITIAL SEED DATA (Ready-to-Use Production Portal)
-- ==============================================================================

-- 1. Default Organization (Neubofy™)
INSERT INTO organizations (
    id, name, slug, profile_image, brand_color, timezone,
    contact_email, reply_to_email, email_from, setup_complete
) VALUES (
    'org_neubofy_main',
    'Neubofy™',
    'neubofy',
    'https://neubofy.in/neubofylogo.png',
    '#3b82f6',
    'Asia/Kolkata',
    'contact@neubofy.in',
    'meet@neubofy.in',
    'Neubofy <booking@updates.neubofy.in>',
    1
);

-- 2. Core Consultation Services
INSERT INTO event_types (
    id, organization_id, name, slug, duration_minutes,
    description, category, is_free_only, price_inr,
    durations_json, icon_name, location_type, is_active
) VALUES 
(
    'service_30min',
    'org_neubofy_main',
    '30-Min Strategy Consultation',
    '30min',
    30,
    'High-impact 30-minute strategic evaluation of your technical architecture, product roadmap, or engineering challenges with a Neubofy lead specialist.',
    'Decide',
    1,
    0,
    '[30, 60]',
    'lightbulb',
    'google_meet',
    1
),
(
    'service_60min',
    'org_neubofy_main',
    '60-Min Architecture Deep Dive',
    '60min',
    60,
    'Comprehensive 60-minute technical consultation: codebase assessment, Cloudflare/AWS cloud architecture review, and system scaling strategy.',
    'Implement',
    1,
    0,
    '[30, 60]',
    'cpu',
    'google_meet',
    1
),
(
    'service_audit',
    'org_neubofy_main',
    'Technical Due Diligence & Codebase Audit',
    'audit',
    45,
    'In-depth audit covering security vulnerabilities, dead code elimination, infrastructure efficiency, and production readiness verification.',
    'Protect & Verify',
    1,
    0,
    '[30, 45, 60]',
    'shield',
    'google_meet',
    1
);

-- 3. Default Welcome VIP Coupon (100% Complimentary Waiver)
INSERT INTO coupons (
    id, organization_id, code, discount_type, discount_value,
    max_uses, used_count, is_active, created_at
) VALUES (
    'coupon_vip_welcome',
    'org_neubofy_main',
    'NEUBOFYVIP',
    'percentage',
    100,
    NULL, -- Unlimited
    0,
    1,
    CURRENT_TIMESTAMP
);
