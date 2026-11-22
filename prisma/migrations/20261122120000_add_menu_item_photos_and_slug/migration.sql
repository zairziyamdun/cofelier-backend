-- image_url никогда не заполнялся (загрузки не было) — фото теперь в menu_item_photos.
ALTER TABLE "menu_items" DROP COLUMN "image_url";

-- slug для уже существующих позиций: латиница из названия + id (уникально);
-- кириллица в SQL не транслитерируется — такие получают «item-<id>».
ALTER TABLE "menu_items" ADD COLUMN "slug" TEXT;
UPDATE "menu_items"
SET "slug" = COALESCE(
    NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER("name"), '[^a-z0-9]+', '-', 'g')), ''),
    'item'
  ) || '-' || "id";
ALTER TABLE "menu_items" ALTER COLUMN "slug" SET NOT NULL;

-- CreateTable
CREATE TABLE "menu_item_photos" (
    "id" SERIAL NOT NULL,
    "menu_item_id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "has_alpha" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_item_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_photos_key_key" ON "menu_item_photos"("key");

-- CreateIndex
CREATE INDEX "menu_item_photos_menu_item_id_sort_order_idx" ON "menu_item_photos"("menu_item_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_slug_key" ON "menu_items"("slug");

-- AddForeignKey
ALTER TABLE "menu_item_photos" ADD CONSTRAINT "menu_item_photos_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
