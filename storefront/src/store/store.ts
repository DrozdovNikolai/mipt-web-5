import { configureStore } from "@reduxjs/toolkit";

import { saveCart } from "../cart";
import cartReducer from "./cartSlice";
import ordersReducer from "./ordersSlice";
import productsReducer from "./productsSlice";

export const store = configureStore({
  reducer: {
    products: productsReducer,
    cart: cartReducer,
    orders: ordersReducer,
  },
});

store.subscribe(() => {
  saveCart(store.getState().cart.items);
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

