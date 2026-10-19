-- AlterTable
ALTER TABLE "routers" ADD COLUMN "wgPrivateKey" TEXT;
ALTER TABLE "routers" ADD COLUMN "wgPublicKey" TEXT;
ALTER TABLE "routers" ADD COLUMN "wgTunnelIp" TEXT;
