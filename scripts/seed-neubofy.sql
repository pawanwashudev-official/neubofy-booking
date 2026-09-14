-- Seed script for Neubofy Organization
-- Keeps consultation services empty so they are created manually by organization experts.

INSERT OR IGNORE INTO organizations (id, name, slug, brand_color, contact_email, reply_to_email, email_from, setup_complete)
VALUES (
    'org_neubofy_main',
    'Neubofy',
    'neubofy',
    '#3b82f6',
    'contact@neubofy.in',
    'meet@neubofy.in',
    'booking@updates.neubofy.in',
    1
);
