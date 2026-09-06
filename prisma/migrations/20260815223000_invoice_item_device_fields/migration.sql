-- Hearing-aid / device line fields on tax invoices
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "model" TEXT;
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "serialNo" TEXT;
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "warranty" TEXT;
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "colour" TEXT;
