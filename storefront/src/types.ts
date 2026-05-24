export type Product = {
  id: string;
  categoryId: string;
  sku: string;
  slug: string;
  name: string;
  category: string;
  categorySlug: string;
  price: number;
  oldPrice?: number;
  stockQty: number;
  powerWatts: number;
  socketType: string;
  colorTemperature: string;
  luminousFlux: number;
  voltage: string;
  lifetimeHours: number;
  isDimmable: boolean;
  description: string;
};

export type ProductImage = {
  id?: string;
  imageUrl: string;
  altText?: string | null;
  sortOrder?: number;
  isMain?: boolean;
};

export type ProductAttribute = {
  id?: string;
  attributeName: string;
  attributeValue: string;
  sortOrder?: number;
};

export type AdminProduct = Product & {
  shortDescription?: string | null;
  basePrice: number;
  discountPrice?: number | null;
  currencyCode: string;
  isActive: boolean;
  images: ProductImage[];
  attributes: ProductAttribute[];
};

export type AdminProductPayload = {
  categoryId: string;
  sku: string;
  name: string;
  slug: string;
  shortDescription?: string | null;
  description?: string | null;
  basePrice: number;
  discountPrice?: number | null;
  stockQty: number;
  powerWatts: number;
  socketType: string;
  colorTemperature: string;
  luminousFlux: number;
  voltage?: string | null;
  lifetimeHours?: number | null;
  isDimmable: boolean;
  isActive: boolean;
  images: ProductImage[];
  attributes: ProductAttribute[];
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
};

export type CartItem = {
  productId: string;
  quantity: number;
};

export type CheckoutForm = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryCity: string;
  deliveryAddress: string;
  deliveryMethod: "courier" | "pickup";
  paymentMethod: "card_online" | "cash_on_delivery";
  customerComment: string;
  personalDataAccepted: boolean;
};

export type OrderItemSnapshot = {
  id: string;
  productId: string;
  skuSnapshot: string;
  productNameSnapshot: string;
  productSlugSnapshot: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  attributesSnapshot?: Record<string, unknown> | null;
};

export type Order = {
  id: string;
  orderNumber: string;
  createdAt: string;
  updatedAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryCity: string;
  deliveryAddress: string;
  deliveryMethod: "courier" | "pickup";
  paymentMethod: "card_online" | "cash_on_delivery";
  orderStatus: "new" | "confirmed" | "assembling" | "shipped" | "delivered" | "canceled";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  customerComment?: string | null;
  managerComment?: string | null;
  subtotalAmount: number;
  deliveryAmount: number;
  totalAmount: number;
  currencyCode: string;
  publicToken?: string;
  items: OrderItemSnapshot[];
  statusHistory?: Array<{
    id: string;
    oldStatus?: Order["orderStatus"] | null;
    newStatus: Order["orderStatus"];
    changedBy: string;
    source: string;
    comment?: string | null;
    createdAt: string;
  }>;
};

export type OrderSummary = Pick<
  Order,
  | "id"
  | "orderNumber"
  | "customerName"
  | "customerPhone"
  | "customerEmail"
  | "deliveryCity"
  | "orderStatus"
  | "paymentStatus"
  | "totalAmount"
  | "currencyCode"
  | "createdAt"
  | "updatedAt"
> & {
  itemsCount: number;
};

export type AdminSession = {
  accessToken: string;
  refreshToken?: string;
  tokenType: "bearer";
  expiresIn: number;
  user: {
    username: string;
    email?: string;
    fullName?: string;
    role: string;
  };
};

export type AdminDashboardSummary = {
  activeProducts: number;
  newOrders: number;
  ordersToday: number;
  revenueTotal: number;
  recentOrders: OrderSummary[];
  recentActions: Array<{
    id: string;
    adminEmail: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    responseCode: number;
    createdAt: string;
  }>;
};

export type ProductsQuery = {
  category?: string;
  socket?: string;
  colorTemperature?: string;
  inStock?: boolean;
  search?: string;
  sort?: "price_asc" | "price_desc" | "name_asc" | "name_desc";
  page?: number;
  pageSize?: number;
};
