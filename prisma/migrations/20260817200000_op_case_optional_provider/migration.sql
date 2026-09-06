-- OP registration no longer requires a doctor at the desk
ALTER TABLE "op_cases" ALTER COLUMN "providerId" DROP NOT NULL;
