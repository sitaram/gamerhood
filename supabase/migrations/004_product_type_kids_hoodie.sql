-- Allow Cotton Heritage youth hoodie as a distinct product_kind.
alter table public.products drop constraint if exists products_product_type_check;

alter table public.products
  add constraint products_product_type_check check (product_type in (
    'hoodie',
    'kids-hoodie',
    'tshirt',
    'joggers',
    'mug',
    'poster',
    'backpack',
    'phone-case',
    'sticker'
  ));
