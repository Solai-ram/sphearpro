-- Item return requests: staff submit, admin approves, stock RETURN on approval
CREATE TYPE "StockReturnStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "stock_return_requests" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "StockReturnStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "stockTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_return_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_return_requests_stockTransactionId_key" ON "stock_return_requests"("stockTransactionId");
CREATE INDEX "stock_return_requests_clinicId_idx" ON "stock_return_requests"("clinicId");
CREATE INDEX "stock_return_requests_status_idx" ON "stock_return_requests"("status");
CREATE INDEX "stock_return_requests_productId_idx" ON "stock_return_requests"("productId");
CREATE INDEX "stock_return_requests_requestedAt_idx" ON "stock_return_requests"("requestedAt");

ALTER TABLE "stock_return_requests" ADD CONSTRAINT "stock_return_requests_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_return_requests" ADD CONSTRAINT "stock_return_requests_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_return_requests" ADD CONSTRAINT "stock_return_requests_stockTransactionId_fkey" FOREIGN KEY ("stockTransactionId") REFERENCES "stock_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_return_requests" ADD CONSTRAINT "stock_return_requests_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_return_requests" ADD CONSTRAINT "stock_return_requests_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
