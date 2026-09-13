-- Organization-owned branding and email delivery settings.
ALTER TABLE organizations ADD COLUMN email_from TEXT;
ALTER TABLE organizations ADD COLUMN setup_complete BOOLEAN DEFAULT 0;

UPDATE organizations
SET email_from = COALESCE(contact_email, 'booking@updates.neubofy.in'),
    setup_complete = CASE WHEN name IS NOT NULL AND contact_email IS NOT NULL THEN 1 ELSE 0 END
WHERE email_from IS NULL;
