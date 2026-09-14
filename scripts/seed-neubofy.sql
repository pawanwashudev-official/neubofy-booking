-- Seed script for Neubofy Organization and Default Consultation Events

-- 1. Ensure Neubofy organization exists
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

-- 2. Seed Neubofy Consultation Services matching neubofy.in pillars
INSERT OR IGNORE INTO event_types (id, organization_id, name, slug, description, category, durations_json, duration_minutes, icon_name, color, is_active, is_free_only, location_type)
VALUES 
(
    'evt_tech_strategy',
    'org_neubofy_main',
    'Technology Strategy & Architecture Assessment',
    'tech-strategy-assessment',
    'Evaluate your business requirements, build vs. buy decisions, system architecture, and technology roadmap before execution.',
    'Decide',
    '[30, 60]',
    30,
    'lightbulb',
    '#3b82f6',
    1,
    1,
    'google_meet'
),
(
    'evt_saas_ai_automation',
    'org_neubofy_main',
    'SaaS, Integrations & AI Automation Advisory',
    'saas-integrations-ai-automation',
    'Solve disconnected systems, evaluate SaaS platforms, plan workflow & AI automations, and architect custom software capabilities.',
    'Implement',
    '[30, 60]',
    30,
    'wrench',
    '#8b5cf6',
    1,
    1,
    'google_meet'
),
(
    'evt_cloud_modernization',
    'org_neubofy_main',
    'Cloud Modernization & DevOps Review',
    'cloud-modernization-devops',
    'Modernize legacy systems, optimize cloud infrastructure costs, accelerate performance, and establish scalable DevOps practices.',
    'Improve',
    '[30, 60]',
    30,
    'refresh-cw',
    '#06b6d4',
    1,
    1,
    'google_meet'
),
(
    'evt_software_audit_security',
    'org_neubofy_main',
    'Software Audit, Security & Verification',
    'software-audit-security-verification',
    'The builder shouldn''t be the only one deciding it''s ready. Independent technical review, software code audit, QA, and security validation.',
    'Protect & Verify',
    '[30, 60]',
    30,
    'shield-check',
    '#10b981',
    1,
    1,
    'google_meet'
),
(
    'evt_external_tech_dept',
    'org_neubofy_main',
    'External Technology Department Consultation',
    'external-tech-department',
    'Your technology department without building one. Ongoing technical strategy, continuous engineering oversight, and system evolution.',
    'Operate',
    '[30, 60]',
    30,
    'settings',
    '#f59e0b',
    1,
    1,
    'google_meet'
);
