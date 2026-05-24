import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { loadCart } from "../cart";
import type { CartItem } from "../types";

type AddToCartPayload = {
  productId: string;
  quantity?: number;
  stockQty: number;
};

type CartState = {
  items: CartItem[];
};

const initialState: CartState = {
  items: loadCart(),
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart(state, action: PayloadAction<AddToCartPayload>) {
      const quantity = action.payload.quantity ?? 1;
      const existing = state.items.find((item) => item.productId === action.payload.productId);
      if (existing) {
        existing.quantity = Math.min(action.payload.stockQty, existing.quantity + quantity);
        return;
      }
      state.items.push({
        productId: action.payload.productId,
        quantity: Math.min(action.payload.stockQty, quantity),
      });
    },
    updateQuantity(state, action: PayloadAction<AddToCartPayload>) {
      const item = state.items.find((entry) => entry.productId === action.payload.productId);
      if (item) {
        item.quantity = Math.min(action.payload.stockQty, Math.max(1, action.payload.quantity ?? 1));
      }
    },
    removeFromCart(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => item.productId !== action.payload);
    },
    clearCart(state) {
      state.items = [];
    },
  },
});

export const { addToCart, updateQuantity, removeFromCart, clearCart } = cartSlice.actions;
export default cartSlice.reducer;

