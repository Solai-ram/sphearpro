-- Drop obsolete unique indexes that were created before multi-tenant clinic scoping
DROP INDEX IF EXISTS "settings_key_key";
DROP INDEX IF EXISTS "therapy_types_name_key";
