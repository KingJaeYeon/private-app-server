/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `tags` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ApiKeyType" AS ENUM ('USER', 'SERVER');

-- AlterTable
ALTER TABLE "tags" DROP COLUMN "updatedAt",
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "api_keys" (
    "id" SERIAL NOT NULL,
    "type" "ApiKeyType" NOT NULL,
    "user_id" TEXT,
    "api_key" TEXT NOT NULL,
    "name" TEXT,
    "usage" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_api_key_usages" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "api_key_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "usage" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_api_key_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_keys_type_is_active_usage_idx" ON "api_keys"("type", "is_active", "usage");

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_user_id_type_key" ON "api_keys"("user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_type_name_key" ON "api_keys"("type", "name");

-- CreateIndex
CREATE INDEX "server_api_key_usages_user_id_date_idx" ON "server_api_key_usages"("user_id", "date");

-- CreateIndex
CREATE INDEX "server_api_key_usages_api_key_id_date_idx" ON "server_api_key_usages"("api_key_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "server_api_key_usages_user_id_api_key_id_date_key" ON "server_api_key_usages"("user_id", "api_key_id", "date");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_api_key_usages" ADD CONSTRAINT "server_api_key_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_api_key_usages" ADD CONSTRAINT "server_api_key_usages_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
