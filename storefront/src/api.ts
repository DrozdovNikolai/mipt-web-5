import type {
  AdminProduct,
  AdminProductPayload,
  AdminDashboardSummary,
  AdminSession,
  CartItem,
  Category,
  CheckoutForm,
  Order,
  OrderSummary,
  Product,
  ProductsQuery,
} from "./types";

const PRODUCTS_API_URL = import.meta.env.VITE_PRODUCTS_API_URL ?? "http://127.0.0.1:8001";
const ORDERS_API_URL = import.meta.env.VITE_ORDERS_API_URL ?? "http://127.0.0.1:8002";
const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL ?? "http://127.0.0.1:3003";

type ApiProduct = {
  id: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
  };
  sku: string;
  slug: string;
  name: string;
  shortDescription?: string | null;
  description?: string | null;
  basePrice: number;
  discountPrice?: number | null;
  currentPrice: number;
  currencyCode?: string;
  stockQty: number;
  powerWatts: number;
  socketType: string;
  colorTemperature: string;
  luminousFlux: number;
  voltage?: string | null;
  lifetimeHours?: number | null;
  isDimmable: boolean;
  isActive?: boolean;
  images?: Array<{
    id: string;
    imageUrl: string;
    altText?: string | null;
    sortOrder: number;
    isMain: boolean;
  }>;
  attributes?: Array<{
    id: string;
    attributeName: string;
    attributeValue: string;
    sortOrder: number;
  }>;
};

type ProductsResponse = {
  items: ApiProduct[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

type OrdersResponse = {
  items: OrderSummary[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

function toApiUrl(baseUrl: string, path: string, params?: Record<string, string | number | boolean | undefined>) {
  const url = new URL(path, baseUrl);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Network request failed");
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const payload = await response.json();
      detail = typeof payload.detail === "string" ? payload.detail : detail;
    } catch {
      detail = response.statusText || detail;
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function mapProduct(product: ApiProduct): Product {
  return {
    id: product.id,
    categoryId: product.categoryId,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    category: product.category.name,
    categorySlug: product.category.slug,
    price: product.currentPrice,
    oldPrice: product.discountPrice ? product.basePrice : undefined,
    stockQty: product.stockQty,
    powerWatts: product.powerWatts,
    socketType: product.socketType,
    colorTemperature: product.colorTemperature,
    luminousFlux: product.luminousFlux,
    voltage: product.voltage ?? "220-240V",
    lifetimeHours: product.lifetimeHours ?? 30000,
    isDimmable: product.isDimmable,
    description: product.description ?? `${product.name} из линейки LampFactory.`,
  };
}

function mapAdminProduct(product: ApiProduct): AdminProduct {
  return {
    ...mapProduct(product),
    shortDescription: product.shortDescription,
    basePrice: product.basePrice,
    discountPrice: product.discountPrice,
    currencyCode: product.currencyCode ?? "RUB",
    isActive: product.isActive ?? true,
    images: product.images ?? [],
    attributes: product.attributes ?? [],
  };
}

export async function loginAdminApi(username: string, password: string): Promise<AdminSession> {
  const session = await requestJson<AdminSession>(toApiUrl(ADMIN_API_URL, "/api/v1/auth/login"), {
    method: "POST",
    body: JSON.stringify({ email: username, password }),
  });
  return {
    ...session,
    user: {
      ...session.user,
      username: session.user.username ?? session.user.email ?? username,
    },
  };
}

export async function logoutAdminApi(session: AdminSession): Promise<void> {
  return requestJson<void>(toApiUrl(ADMIN_API_URL, "/api/v1/auth/logout"), {
    method: "POST",
    headers: authHeader(session.accessToken),
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
}

export async function fetchCategoriesApi(): Promise<Category[]> {
  return requestJson<Category[]>(toApiUrl(PRODUCTS_API_URL, "/api/v1/categories"));
}

export async function fetchAdminCategoriesApi(token: string): Promise<Category[]> {
  return requestJson<Category[]>(toApiUrl(ADMIN_API_URL, "/api/v1/admin/categories"), {
    headers: authHeader(token),
  });
}

export async function fetchProductsApi(query: ProductsQuery = {}) {
  const response = await requestJson<ProductsResponse>(
    toApiUrl(PRODUCTS_API_URL, "/api/v1/products", {
      category: query.category,
      socket: query.socket,
      colorTemperature: query.colorTemperature,
      inStock: query.inStock,
      search: query.search,
      sort: query.sort,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 100,
    }),
  );

  return {
    ...response,
    items: response.items.map(mapProduct),
  };
}

export async function fetchProductBySlugApi(slug: string): Promise<Product> {
  const product = await requestJson<ApiProduct>(toApiUrl(PRODUCTS_API_URL, `/api/v1/products/slug/${slug}`));
  return mapProduct(product);
}

export async function fetchAdminProductsApi(token: string, query: ProductsQuery = {}) {
  const response = await requestJson<ProductsResponse>(
    toApiUrl(ADMIN_API_URL, "/api/v1/admin/products", {
      category: query.category,
      search: query.search,
      sort: query.sort ?? "name_asc",
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 100,
    }),
    { headers: authHeader(token) },
  );

  return {
    ...response,
    items: response.items.map(mapAdminProduct),
  };
}

export async function fetchAdminProductApi(token: string, productId: string): Promise<AdminProduct> {
  const product = await requestJson<ApiProduct>(
    toApiUrl(ADMIN_API_URL, `/api/v1/admin/products/${productId}`),
    { headers: authHeader(token) },
  );
  return mapAdminProduct(product);
}

export async function createAdminProductApi(token: string, payload: AdminProductPayload): Promise<AdminProduct> {
  const product = await requestJson<ApiProduct>(toApiUrl(ADMIN_API_URL, "/api/v1/admin/products"), {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(payload),
  });
  return mapAdminProduct(product);
}

export async function updateAdminProductApi(
  token: string,
  productId: string,
  payload: AdminProductPayload,
): Promise<AdminProduct> {
  const product = await requestJson<ApiProduct>(toApiUrl(ADMIN_API_URL, `/api/v1/admin/products/${productId}`), {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify(payload),
  });
  return mapAdminProduct(product);
}

export async function deleteAdminProductApi(token: string, productId: string): Promise<void> {
  return requestJson<void>(toApiUrl(ADMIN_API_URL, `/api/v1/admin/products/${productId}`), {
    method: "DELETE",
    headers: authHeader(token),
  });
}

export async function createOrderApi(form: CheckoutForm, items: CartItem[]): Promise<Order> {
  return requestJson<Order>(toApiUrl(ORDERS_API_URL, "/api/v1/orders"), {
    method: "POST",
    body: JSON.stringify({
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      customerEmail: form.customerEmail,
      deliveryCity: form.deliveryCity,
      deliveryAddress: form.deliveryAddress,
      deliveryMethod: form.deliveryMethod,
      paymentMethod: form.paymentMethod,
      customerComment: form.customerComment,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    }),
  });
}

export async function fetchAdminOrdersApi(
  token: string,
  options: { search?: string; status?: Order["orderStatus"] | "" } = {},
): Promise<OrdersResponse> {
  return requestJson<OrdersResponse>(
    toApiUrl(ADMIN_API_URL, "/api/v1/admin/orders", {
      search: options.search,
      status: options.status,
      page: 1,
      pageSize: 100,
    }),
    { headers: authHeader(token) },
  );
}

export async function updateAdminOrderStatusApi(
  token: string,
  orderId: string,
  status: Order["orderStatus"],
): Promise<Order> {
  return requestJson<Order>(toApiUrl(ADMIN_API_URL, `/api/v1/admin/orders/${orderId}/status`), {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify({ status }),
  });
}

export async function fetchAdminOrderApi(token: string, orderId: string): Promise<Order> {
  return requestJson<Order>(toApiUrl(ADMIN_API_URL, `/api/v1/admin/orders/${orderId}`), {
    headers: authHeader(token),
  });
}

export async function updateAdminOrderPaymentStatusApi(
  token: string,
  orderId: string,
  paymentStatus: Order["paymentStatus"],
): Promise<Order> {
  return requestJson<Order>(toApiUrl(ADMIN_API_URL, `/api/v1/admin/orders/${orderId}/payment-status`), {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify({ paymentStatus }),
  });
}

export async function updateAdminOrderManagerCommentApi(
  token: string,
  orderId: string,
  managerComment: string,
): Promise<Order> {
  return requestJson<Order>(toApiUrl(ADMIN_API_URL, `/api/v1/admin/orders/${orderId}/manager-comment`), {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify({ managerComment }),
  });
}

export async function fetchAdminDashboardApi(token: string): Promise<AdminDashboardSummary> {
  return requestJson<AdminDashboardSummary>(toApiUrl(ADMIN_API_URL, "/api/v1/dashboard/summary"), {
    headers: authHeader(token),
  });
}
