-- AlterTable
ALTER TABLE "order_item_modifiers" ADD COLUMN     "option_id" INTEGER;

-- AddForeignKey
ALTER TABLE "order_item_modifiers" ADD CONSTRAINT "order_item_modifiers_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "modifier_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
