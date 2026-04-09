import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CartItem, Product } from "./types";

function cartItemKey(item: { product: { id: string }; selectedColor: string; selectedSize?: string }): string {
  return `${item.product.id}::${item.selectedColor}::${item.selectedSize || ""}`;
}

interface CartStore {
  items: CartItem[];
  addItem: (product: Product, color: string, size?: string) => void;
  removeItem: (productId: string, color: string, size?: string) => void;
  updateQuantity: (productId: string, color: string, size: string | undefined, quantity: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, color, size) => {
        const items = get().items;
        const key = cartItemKey({ product, selectedColor: color, selectedSize: size });
        const existingIdx = items.findIndex((i) => cartItemKey(i) === key);
        if (existingIdx >= 0) {
          set({
            items: items.map((item, idx) =>
              idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item,
            ),
          });
        } else {
          set({
            items: [...items, { product, quantity: 1, selectedColor: color, selectedSize: size }],
          });
        }
      },

      removeItem: (productId, color, size) => {
        const key = `${productId}::${color}::${size || ""}`;
        set({ items: get().items.filter((i) => cartItemKey(i) !== key) });
      },

      updateQuantity: (productId, color, size, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId, color, size);
          return;
        }
        const key = `${productId}::${color}::${size || ""}`;
        set({
          items: get().items.map((i) =>
            cartItemKey(i) === key ? { ...i, quantity } : i,
          ),
        });
      },

      clearCart: () => set({ items: [] }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      totalPrice: () =>
        get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    }),
    { name: "gamerhood-cart" },
  ),
);
