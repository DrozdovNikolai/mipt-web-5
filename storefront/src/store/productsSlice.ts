import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { fetchCategoriesApi, fetchProductBySlugApi, fetchProductsApi } from "../api";
import type { Category, Product, ProductsQuery } from "../types";

type ProductsState = {
  items: Product[];
  byId: Record<string, Product>;
  currentProduct: Product | null;
  categories: Category[];
  total: number;
  status: "idle" | "loading" | "succeeded" | "failed";
  detailStatus: "idle" | "loading" | "succeeded" | "failed";
  error: string | null;
};

const initialState: ProductsState = {
  items: [],
  byId: {},
  currentProduct: null,
  categories: [],
  total: 0,
  status: "idle",
  detailStatus: "idle",
  error: null,
};

export const loadCategories = createAsyncThunk("products/loadCategories", fetchCategoriesApi);

export const loadProducts = createAsyncThunk("products/loadProducts", async (query: ProductsQuery = {}) =>
  fetchProductsApi(query),
);

export const loadProductBySlug = createAsyncThunk("products/loadProductBySlug", async (slug: string) =>
  fetchProductBySlugApi(slug),
);

const productsSlice = createSlice({
  name: "products",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadCategories.fulfilled, (state, action: PayloadAction<Category[]>) => {
        state.categories = action.payload;
      })
      .addCase(loadProducts.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loadProducts.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = action.payload.items;
        state.total = action.payload.total;
        action.payload.items.forEach((product) => {
          state.byId[product.id] = product;
        });
      })
      .addCase(loadProducts.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "Не удалось загрузить каталог";
      })
      .addCase(loadProductBySlug.pending, (state) => {
        state.detailStatus = "loading";
        state.error = null;
      })
      .addCase(loadProductBySlug.fulfilled, (state, action: PayloadAction<Product>) => {
        state.detailStatus = "succeeded";
        state.currentProduct = action.payload;
        state.byId[action.payload.id] = action.payload;
      })
      .addCase(loadProductBySlug.rejected, (state, action) => {
        state.detailStatus = "failed";
        state.currentProduct = null;
        state.error = action.error.message ?? "Не удалось загрузить товар";
      });
  },
});

export default productsSlice.reducer;

