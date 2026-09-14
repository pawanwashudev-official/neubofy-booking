-- Organization events may be hosted by one or more active organization members.
CREATE TABLE IF NOT EXISTS event_type_hosts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    event_type_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_type_id, user_id),
    FOREIGN KEY (event_type_id) REFERENCES event_types(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_type_hosts_event
    ON event_type_hosts(event_type_id, is_active);
CREATE INDEX IF NOT EXISTS idx_event_type_hosts_org
    ON event_type_hosts(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_event_type_hosts_user
    ON event_type_hosts(user_id, is_active);

ALTER TABLE users ADD COLUMN public_title TEXT;
ALTER TABLE users ADD COLUMN public_bio TEXT;
ALTER TABLE users ADD COLUMN public_specialties TEXT;
ALTER TABLE users ADD COLUMN public_contact_email TEXT;
ALTER TABLE users ADD COLUMN public_mobile TEXT;
ALTER TABLE users ADD COLUMN public_social_handle TEXT;
ALTER TABLE users ADD COLUMN public_profile_enabled BOOLEAN DEFAULT 0;
ALTER TABLE email_templates ADD COLUMN html_template TEXT;

-- Preserve existing single-host events during the transition to assignments.
INSERT OR IGNORE INTO event_type_hosts (event_type_id, organization_id, user_id)
SELECT et.id, et.organization_id, et.user_id
FROM event_types et
JOIN organization_members om
  ON om.organization_id = et.organization_id
 AND om.user_id = et.user_id
 AND om.is_active = 1
WHERE et.organization_id IS NOT NULL;