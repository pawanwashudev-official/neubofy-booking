-- Migration 0012: Coupons, Consultation Pricing Controls, and Booking Discounts

-- Add base price in INR to event_types
ALTER TABLE event_types ADD COLUMN price_inr INTEGER DEFAULT 0;

-- Add coupon code and discount amount to bookings
ALTER TABLE bookings ADD COLUMN coupon_code TEXT;
ALTER TABLE bookings ADD COLUMN discount_amount INTEGER DEFAULT 0;

-- Coupons table for admin/owner discount and complimentary VIP waivers
CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT NOT NULL DEFAULT 'org_neubofy_main',
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value INTEGER NOT NULL, -- e.g. 100 for 100% off (complimentary), 500 for ₹500 off
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

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_org ON coupons(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_event ON coupons(event_type_id);
