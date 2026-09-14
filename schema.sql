-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    profile_image TEXT,
    brand_color TEXT DEFAULT '#3b82f6',
    timezone TEXT DEFAULT 'UTC',
    contact_email TEXT,
    reply_to_email TEXT,
    email_from TEXT,
    setup_complete BOOLEAN DEFAULT 0,
    settings JSON DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Users table (Admins and Member Experts)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    google_refresh_token TEXT,
    outlook_refresh_token TEXT,
    timezone TEXT DEFAULT 'UTC',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sync_token TEXT,
    last_sync DATETIME,
    slug TEXT UNIQUE NOT NULL,
    settings JSON DEFAULT '{}',
    profile_image TEXT,
    brand_color TEXT DEFAULT '#3b82f6',
    contact_email TEXT,
    role_title TEXT DEFAULT 'Technology Consultant',
    bio TEXT,
    phone TEXT,
    session_pricing JSON DEFAULT '[{"duration": 30, "price": 999, "label": "30 Min Strategy Consultation"}, {"duration": 60, "price": 1999, "label": "60 Min Deep Dive"}]',
    is_free_consultation BOOLEAN DEFAULT 1,
    is_active BOOLEAN DEFAULT 1,
    last_login_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_users_slug ON users(slug);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Organization memberships and invitation-only access
CREATE TABLE IF NOT EXISTS organization_members (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    is_active BOOLEAN DEFAULT 1,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, user_id),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id, is_active);

CREATE TABLE IF NOT EXISTS organization_invitations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    invited_by TEXT NOT NULL,
    token_digest TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    accepted_at DATETIME,
    revoked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(organization_id, email, expires_at);
CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON organization_invitations(token_digest);

-- Event types (Organization Consultation Services)
CREATE TABLE IF NOT EXISTS event_types (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT,
    organization_id TEXT,
    name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    buffer_minutes INTEGER DEFAULT 0,
    color TEXT DEFAULT '#3b82f6',
    slug TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'Decide', -- Decide, Implement, Improve, Protect & Verify, Operate
    is_free_only BOOLEAN DEFAULT 1,
    durations_json TEXT DEFAULT '[30, 60]',
    icon_name TEXT DEFAULT 'lightbulb',
    location_type TEXT DEFAULT 'google_meet', -- google_meet, zoom, phone, in_person
    location_details TEXT,
    is_active BOOLEAN DEFAULT 1,
    cover_image TEXT,
    availability_calendars TEXT DEFAULT 'google',
    invite_calendar TEXT DEFAULT 'google',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_event_types_user ON event_types(user_id);
CREATE INDEX IF NOT EXISTS idx_event_types_active ON event_types(is_active);
CREATE INDEX IF NOT EXISTS idx_event_types_slug ON event_types(slug);

-- Junction table for assigning multiple experts to an organization consultation event
CREATE TABLE IF NOT EXISTS event_type_members (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    event_type_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    custom_pricing JSON, -- Optional custom duration & pricing packages override: [{"duration": 45, "price": 1499, "label": "..."}]
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_type_id, user_id),
    FOREIGN KEY (event_type_id) REFERENCES event_types(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_etm_event ON event_type_members(event_type_id);
CREATE INDEX IF NOT EXISTS idx_etm_user ON event_type_members(user_id);

-- Availability rules (recurring weekly schedule)
CREATE TABLE IF NOT EXISTS availability_rules (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    organization_id TEXT,
    event_type_id TEXT,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (event_type_id) REFERENCES event_types(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_availability_rules_user ON availability_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_availability_rules_active ON availability_rules(user_id, is_active);

-- Availability overrides (specific date exceptions)
CREATE TABLE IF NOT EXISTS availability_overrides (
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

CREATE INDEX IF NOT EXISTS idx_availability_overrides_user_date ON availability_overrides(user_id, date);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    event_type_id TEXT NOT NULL,
    organization_id TEXT,
    user_id TEXT NOT NULL, -- Assigned Expert Host
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
    price_amount INTEGER DEFAULT 0,
    is_paid BOOLEAN DEFAULT 0,
    email_verified BOOLEAN DEFAULT 1,
    google_event_id TEXT,
    outlook_event_id TEXT,
    meeting_url TEXT,
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'canceled', 'rescheduled')),
    canceled_at DATETIME,
    canceled_by TEXT CHECK (canceled_by IN ('host', 'attendee')),
    cancellation_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_type_id) REFERENCES event_types(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_time ON bookings(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_event_type ON bookings(event_type_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_google_event ON bookings(google_event_id);

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

-- Cache control table
CREATE TABLE IF NOT EXISTS cache_control (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_control(expires_at);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    date DATE NOT NULL,
    endpoint TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    UNIQUE(date, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(date);

-- Sessions for auth
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Webhook subscriptions
CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT NOT NULL,
    secret TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id);

-- Email templates and settings
CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    organization_id TEXT,
    template_type TEXT NOT NULL CHECK (template_type IN ('confirmation', 'cancellation', 'reschedule', 'reminder_24h', 'reminder_1h', 'reminder_30m')),
    is_enabled BOOLEAN DEFAULT 1,
    subject TEXT,
    custom_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, template_type)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_user ON email_templates(user_id);

-- Scheduled emails for reminders
CREATE TABLE IF NOT EXISTS scheduled_emails (
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

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_pending ON scheduled_emails(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_booking ON scheduled_emails(booking_id);

-- Reschedule proposals for host-initiated reschedules
CREATE TABLE IF NOT EXISTS reschedule_proposals (
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

CREATE INDEX IF NOT EXISTS idx_reschedule_proposals_booking ON reschedule_proposals(booking_id);
CREATE INDEX IF NOT EXISTS idx_reschedule_proposals_token ON reschedule_proposals(response_token);
CREATE INDEX IF NOT EXISTS idx_reschedule_proposals_status ON reschedule_proposals(status);

-- Views for common queries
CREATE VIEW IF NOT EXISTS active_event_types AS
SELECT * FROM event_types WHERE is_active = 1;

CREATE VIEW IF NOT EXISTS upcoming_bookings AS
SELECT * FROM bookings 
WHERE status = 'confirmed' 
AND start_time > CURRENT_TIMESTAMP 
ORDER BY start_time;