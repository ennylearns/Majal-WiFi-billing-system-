-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "routerId" TEXT;

-- CreateTable
CREATE TABLE "routers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 8728,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" REAL NOT NULL,
    "duration" INTEGER NOT NULL,
    "dataLimit" TEXT NOT NULL,
    "speedLimit" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "routerId" TEXT,
    CONSTRAINT "plans_routerId_fkey" FOREIGN KEY ("routerId") REFERENCES "routers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_plans" ("createdAt", "dataLimit", "description", "duration", "id", "isActive", "name", "price", "speedLimit", "updatedAt") SELECT "createdAt", "dataLimit", "description", "duration", "id", "isActive", "name", "price", "speedLimit", "updatedAt" FROM "plans";
DROP TABLE "plans";
ALTER TABLE "new_plans" RENAME TO "plans";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
