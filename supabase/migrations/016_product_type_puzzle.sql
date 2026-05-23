-- Jigsaw puzzle (Printful home & living).
alter table public.products drop constraint if exists products_product_type_check;

alter table public.products
  add constraint products_product_type_check check (product_type in (
    'hoodie',
    'kids-hoodie',
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
    'puzzle'
  ));
