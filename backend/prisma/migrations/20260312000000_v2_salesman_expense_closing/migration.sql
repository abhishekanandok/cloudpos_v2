-- Add salesmanPrice to products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "salesmanPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Create SalesmanType enum
DO $$ BEGIN
  CREATE TYPE "SalesmanType" AS ENUM ('STAFF', 'RESELLER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create salesmen table
CREATE TABLE IF NOT EXISTS "salesmen" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT,
    "loginId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "type" "SalesmanType" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "salesmen_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "salesmen_loginId_key" ON "salesmen"("loginId");
ALTER TABLE "salesmen" DROP CONSTRAINT IF EXISTS "salesmen_shopId_fkey";
ALTER TABLE "salesmen" ADD CONSTRAINT "salesmen_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add salesmanId to sales
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "salesmanId" TEXT;
ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "sales_salesmanId_fkey";
ALTER TABLE "sales" ADD CONSTRAINT "sales_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "salesmen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create expense_categories table
CREATE TABLE IF NOT EXISTS "expense_categories" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS "expenses" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "categoryId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "expenses_shopId_fkey";
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "expenses_categoryId_fkey";
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create daily_cash_closings table
CREATE TABLE IF NOT EXISTS "daily_cash_closings" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "closingDate" TIMESTAMP(3) NOT NULL,
    "expectedCash" DECIMAL(10,2) NOT NULL,
    "actualCash" DECIMAL(10,2) NOT NULL,
    "difference" DECIMAL(10,2) NOT NULL,
    "totalCashSales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalUpiSales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalCardSales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalCreditSales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "closedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_cash_closings_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "daily_cash_closings" DROP CONSTRAINT IF EXISTS "daily_cash_closings_shopId_fkey";
ALTER TABLE "daily_cash_closings" ADD CONSTRAINT "daily_cash_closings_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────
-- DRIVER / VEHICLE MODULE
-- ─────────────────────────────────────────────

-- VehicleLoadType enum
DO $$ BEGIN
  CREATE TYPE "VehicleLoadType" AS ENUM ('LOAD', 'UNLOAD');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- drivers table
CREATE TABLE IF NOT EXISTS "drivers" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT,
    "loginId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "vehicle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "drivers_loginId_key" ON "drivers"("loginId");
ALTER TABLE "drivers" DROP CONSTRAINT IF EXISTS "drivers_shopId_fkey";
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE;

-- vehicle_stocks table
CREATE TABLE IF NOT EXISTS "vehicle_stocks" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vehicle_stocks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_stocks_driverId_productId_key" ON "vehicle_stocks"("driverId","productId");
ALTER TABLE "vehicle_stocks" DROP CONSTRAINT IF EXISTS "vehicle_stocks_driverId_fkey";
ALTER TABLE "vehicle_stocks" ADD CONSTRAINT "vehicle_stocks_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE;

-- vehicle_loads table
CREATE TABLE IF NOT EXISTS "vehicle_loads" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "type" "VehicleLoadType" NOT NULL DEFAULT 'LOAD',
    "notes" TEXT,
    "loadDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vehicle_loads_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "vehicle_loads" DROP CONSTRAINT IF EXISTS "vehicle_loads_driverId_fkey";
ALTER TABLE "vehicle_loads" ADD CONSTRAINT "vehicle_loads_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE;

-- vehicle_load_items table
CREATE TABLE IF NOT EXISTS "vehicle_load_items" (
    "id" TEXT NOT NULL,
    "loadId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    CONSTRAINT "vehicle_load_items_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "vehicle_load_items" DROP CONSTRAINT IF EXISTS "vehicle_load_items_loadId_fkey";
ALTER TABLE "vehicle_load_items" ADD CONSTRAINT "vehicle_load_items_loadId_fkey"
  FOREIGN KEY ("loadId") REFERENCES "vehicle_loads"("id") ON DELETE CASCADE;

-- driver_logs table
CREATE TABLE IF NOT EXISTS "driver_logs" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "amount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "driver_logs_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "driver_logs" DROP CONSTRAINT IF EXISTS "driver_logs_driverId_fkey";
ALTER TABLE "driver_logs" ADD CONSTRAINT "driver_logs_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE;

-- Add driverId to sales table
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "driverId" TEXT;
ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "sales_driverId_fkey";
ALTER TABLE "sales" ADD CONSTRAINT "sales_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL;

-- ─────────────────────────────────────────────
-- DRIVER TRIP SETTLEMENT
-- ─────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "TripStatus" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "driver_trips" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "tripDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TripStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "driver_trips_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "driver_trips" DROP CONSTRAINT IF EXISTS "driver_trips_driverId_fkey";
ALTER TABLE "driver_trips" ADD CONSTRAINT "driver_trips_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE;

ALTER TABLE "vehicle_loads" ADD COLUMN IF NOT EXISTS "tripId" TEXT;
