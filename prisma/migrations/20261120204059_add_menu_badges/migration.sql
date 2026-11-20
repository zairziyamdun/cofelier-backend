-- CreateEnum
CREATE TYPE "MenuBadge" AS ENUM ('seasonal', 'signature', 'decaf');

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "badges" "MenuBadge"[] DEFAULT ARRAY[]::"MenuBadge"[],
ADD COLUMN     "new_until" TIMESTAMP(3);
