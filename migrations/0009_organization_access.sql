-- Organization ownership, memberships, and invitation-only access.
-- The backfill creates one organization for the existing single-user install.

CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    profile_image TEXT,
    brand_color TEXT DEFAULT '#3b82f6',
    timezone TEXT DEFAULT 'UTC',
    contact_email TEXT,
    reply_to_email TEXT,
    settings JSON DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organization_members (
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

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id, is_active);

CREATE TABLE IF NOT EXISTS organization_invitations (
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
    FOREIGN KEY (invited_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(organization_id, email, expires_at);
CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON organization_invitations(token_digest);

ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1;
ALTER TABLE users ADD COLUMN last_login_at DATETIME;
ALTER TABLE event_types ADD COLUMN organization_id TEXT REFERENCES organizations(id);
ALTER TABLE availability_rules ADD COLUMN organization_id TEXT REFERENCES organizations(id);
ALTER TABLE availability_overrides ADD COLUMN organization_id TEXT REFERENCES organizations(id);
ALTER TABLE bookings ADD COLUMN organization_id TEXT REFERENCES organizations(id);
ALTER TABLE email_templates ADD COLUMN organization_id TEXT REFERENCES organizations(id);

INSERT INTO organizations (id, name, slug, profile_image, brand_color, timezone, contact_email)
SELECT
    lower(hex(randomblob(16))),
    COALESCE((SELECT name FROM users ORDER BY created_at LIMIT 1), 'My Organization'),
    COALESCE((SELECT slug FROM users ORDER BY created_at LIMIT 1), 'organization'),
    (SELECT profile_image FROM users ORDER BY created_at LIMIT 1),
    COALESCE((SELECT brand_color FROM users ORDER BY created_at LIMIT 1), '#3b82f6'),
    COALESCE((SELECT timezone FROM users ORDER BY created_at LIMIT 1), 'UTC'),
    COALESCE((SELECT contact_email FROM users ORDER BY created_at LIMIT 1), (SELECT email FROM users ORDER BY created_at LIMIT 1))
WHERE EXISTS (SELECT 1 FROM users) AND NOT EXISTS (SELECT 1 FROM organizations);

INSERT OR IGNORE INTO organization_members (organization_id, user_id, role)
SELECT o.id, u.id, 'owner'
FROM organizations o
JOIN users u ON u.id = (SELECT id FROM users ORDER BY created_at LIMIT 1);

UPDATE event_types SET organization_id = (SELECT organization_id FROM organization_members WHERE user_id = event_types.user_id LIMIT 1) WHERE organization_id IS NULL;
UPDATE availability_rules SET organization_id = (SELECT organization_id FROM organization_members WHERE user_id = availability_rules.user_id LIMIT 1) WHERE organization_id IS NULL;
UPDATE availability_overrides SET organization_id = (SELECT organization_id FROM organization_members WHERE user_id = availability_overrides.user_id LIMIT 1) WHERE organization_id IS NULL;
UPDATE bookings SET organization_id = (SELECT organization_id FROM organization_members WHERE user_id = bookings.user_id LIMIT 1) WHERE organization_id IS NULL;
UPDATE email_templates SET organization_id = (SELECT organization_id FROM organization_members WHERE user_id = email_templates.user_id LIMIT 1) WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_types_org ON event_types(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_availability_rules_org ON availability_rules(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_availability_overrides_org_date ON availability_overrides(organization_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_org_time ON bookings(organization_id, start_time);
CREATE INDEX IF NOT EXISTS idx_email_templates_org ON email_templates(organization_id, template_type);