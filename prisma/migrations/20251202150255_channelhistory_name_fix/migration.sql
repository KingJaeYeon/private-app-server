/*
  Warnings:

  - You are about to drop the `ChannelHistory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ChannelHistory" DROP CONSTRAINT "ChannelHistory_channel_id_fkey";

-- DropTable
DROP TABLE "ChannelHistory";

-- CreateTable
CREATE TABLE "channel_histories" (
    "id" SERIAL NOT NULL,
    "channel_id" INTEGER NOT NULL,
    "video_count" INTEGER NOT NULL DEFAULT 0,
    "view_count" BIGINT NOT NULL DEFAULT 0,
    "subscriber_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_histories_channel_id_idx" ON "channel_histories"("channel_id");

-- AddForeignKey
ALTER TABLE "channel_histories" ADD CONSTRAINT "channel_histories_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
