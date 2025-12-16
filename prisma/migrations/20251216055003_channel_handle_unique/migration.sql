/*
  Warnings:

  - A unique constraint covering the columns `[handle]` on the table `channels` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "channels_handle_key" ON "channels"("handle");
