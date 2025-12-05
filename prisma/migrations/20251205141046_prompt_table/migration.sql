-- CreateTable
CREATE TABLE "prompts" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prompts_user_id_idx" ON "prompts"("user_id");

-- AddForeignKey
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
