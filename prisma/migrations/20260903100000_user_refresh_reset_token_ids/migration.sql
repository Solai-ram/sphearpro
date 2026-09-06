-- Align users token columns with prisma/schema.prisma
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "refreshTokenId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetTokenId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_refreshTokenId_key" ON "users"("refreshTokenId");
CREATE UNIQUE INDEX IF NOT EXISTS "users_resetTokenId_key" ON "users"("resetTokenId");
