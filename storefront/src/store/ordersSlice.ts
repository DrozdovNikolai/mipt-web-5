import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { createOrderApi } from "../api";
import { loadLastOrder, saveLastOrder } from "../cart";
import type { CartItem, CheckoutForm, Order } from "../types";

type OrdersState = {
  lastOrder: Order | null;
  status: "idle" | "loading" | "succeeded" | "failed";
  error: string | null;
};

const initialState: OrdersState = {
  lastOrder: loadLastOrder(),
  status: "idle",
  error: null,
};

export const createOrder = createAsyncThunk(
  "orders/createOrder",
  async ({ form, items }: { form: CheckoutForm; items: CartItem[] }) => {
    const order = await createOrderApi(form, items);
    saveLastOrder(order);
    return order;
  },
);

const ordersSlice = createSlice({
  name: "orders",
  initialState,
  reducers: {
    restoreLastOrder(state, action: PayloadAction<Order | null>) {
      state.lastOrder = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createOrder.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(createOrder.fulfilled, (state, action: PayloadAction<Order>) => {
        state.status = "succeeded";
        state.lastOrder = action.payload;
      })
      .addCase(createOrder.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "Не удалось создать заказ";
      });
  },
});

export const { restoreLastOrder } = ordersSlice.actions;
export default ordersSlice.reducer;

