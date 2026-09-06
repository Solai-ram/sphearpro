-- referenceId is a polymorphic pointer (OP case, patient package, or therapy session),
-- not a foreign key to therapy_sessions only.
ALTER TABLE "invoice_items" DROP CONSTRAINT IF EXISTS "invoice_items_referenceId_fkey";

CREATE INDEX IF NOT EXISTS "invoice_items_billableType_referenceId_idx" ON "invoice_items"("billableType", "referenceId");
