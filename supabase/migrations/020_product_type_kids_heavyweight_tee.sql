-- Youth garment-dyed heavyweight tee — Comfort Colors 9018 (Printful kids / teen).
alter table public.products drop constraint if exists products_product_type_check;

alter table public.products
  add constraint products_product_type_check check (product_type in (
    'hoodie',
    'kids-hoodie',
    'kids-heavyweight-tee',
    'kids-long-sleeve',
    'kids-sports-tee',
    'kids-tshirt',
    'tshirt',
    'joggers',
    'mug',
    'poster',
    'backpack',
    'phone-case',
    'sticker',
    'pillow',
    'blanket',
    'pet-sweater',
    'tote-bag',
    'ornament',
    'puzzle',
    'embroidered-patch',
    'hardcover-journal'
  ));
