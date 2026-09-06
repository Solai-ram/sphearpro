-- Lab tests billed through the central invoice engine
ALTER TYPE "BillableType" ADD VALUE IF NOT EXISTS 'LAB_TEST';
