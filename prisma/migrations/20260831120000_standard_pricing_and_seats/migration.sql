-- Standard plan: ₹1,800/mo or ₹1,500/mo when billed yearly; 5 staff + 1 admin
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "maxStaffUsers" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "maxAdminUsers" INTEGER NOT NULL DEFAULT 1;
