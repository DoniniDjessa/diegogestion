import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import type {
  Category,
  MenuCategory,
  Order,
  OrderChannel,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Product,
  RestaurantTable,
  TableStatus,
} from "@/lib/types";
import { DIEGO_STORAGE_BUCKET, DIEGO_TABLES } from "./constants";
import { fetchCurrentRole, isAdminRole } from "@/lib/auth";
import { compressImage } from "@/lib/image";

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  category: Category;
  price: number;
  image_path: string | null;
  in_stock: boolean;
  signature: boolean;
  sort_order: number;
};

type MenuCategoryRow = {
  id: string;
  slug: string;
  label: string;
  sort_order: number;
};

type TableRow = {
  id: string;
  label: string;
  seats: number;
  status: TableStatus;
  position_x: number;
  position_y: number;
  qr_token: string;
};

type OrderRow = {
  id: string;
  order_number: number;
  customer_id: string | null;
  channel: OrderChannel;
  status: OrderStatus;
  restaurant_table_id: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  payment_method: PaymentMethod | null;
  payment_status: PaymentStatus;
  total: number;
  note: string | null;
  created_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  note: string | null;
};

function requireSupabase() {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase environment variables are not configured.");
  }
  return supabase;
}

export function productImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  return supabase.storage.from(DIEGO_STORAGE_BUCKET).getPublicUrl(imagePath).data
    .publicUrl;
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    category: row.category,
    price: row.price,
    inStock: row.in_stock,
    imageUrl: productImageUrl(row.image_path),
    imagePath: row.image_path,
    signature: row.signature,
  };
}

async function requireAuthenticatedSession() {
  const supabase = requireSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Staff authentication required.");
  }
  return supabase;
}

async function requireAdminSession() {
  const supabase = await requireAuthenticatedSession();
  const role = await fetchCurrentRole();
  if (!isAdminRole(role)) {
    throw new Error(
      "Cette action nécessite un compte admin ou superAdmin enregistré dans Diego."
    );
  }
  return supabase;
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await requireSupabase()
    .from(DIEGO_TABLES.products)
    .select(
      "id,name,description,category,price,image_path,in_stock,signature,sort_order"
    )
    .eq("active", true)
    .order("sort_order")
    .order("name");

  if (error) throw error;
  return ((data ?? []) as ProductRow[]).map(toProduct);
}

export async function fetchMenuCategories(): Promise<MenuCategory[]> {
  const { data, error } = await requireSupabase()
    .from(DIEGO_TABLES.menuCategories)
    .select("id,slug,label,sort_order")
    .eq("active", true)
    .order("sort_order")
    .order("label");
  if (error) throw error;
  return ((data ?? []) as MenuCategoryRow[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    label: row.label,
    sortOrder: row.sort_order,
  }));
}

export type MenuCategoryInput = {
  label: string;
  sortOrder: number;
};

function categorySlug(label: string): string {
  const base = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "categorie"}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function createMenuCategory(
  input: MenuCategoryInput
): Promise<void> {
  const supabase = await requireAdminSession();
  const { error } = await supabase.from(DIEGO_TABLES.menuCategories).insert({
    slug: categorySlug(input.label),
    label: input.label.trim(),
    sort_order: input.sortOrder,
  });
  if (error) throw error;
}

export async function updateMenuCategory(
  categoryId: string,
  input: MenuCategoryInput
): Promise<void> {
  const supabase = await requireAdminSession();
  const { data, error } = await supabase
    .from(DIEGO_TABLES.menuCategories)
    .update({ label: input.label.trim(), sort_order: input.sortOrder })
    .eq("id", categoryId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Category update was not authorized.");
}

export async function deleteMenuCategory(categoryId: string): Promise<void> {
  const supabase = await requireAdminSession();
  const { data, error } = await supabase
    .from(DIEGO_TABLES.menuCategories)
    .update({ active: false })
    .eq("id", categoryId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Category deletion was not authorized.");
}

export async function setProductStock(
  productId: string,
  inStock: boolean
): Promise<void> {
  const { data, error } = await (await requireAdminSession())
    .from(DIEGO_TABLES.products)
    .update({ in_stock: inStock })
    .eq("id", productId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Product update was not authorized.");
}

export type ProductInput = {
  name: string;
  description?: string;
  category: Category;
  price: number;
  imagePath?: string | null;
  inStock: boolean;
  signature: boolean;
};

function productSlug(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "produit"}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createProduct(input: ProductInput): Promise<void> {
  const supabase = await requireAdminSession();
  const { error } = await supabase.from(DIEGO_TABLES.products).insert({
    slug: productSlug(input.name),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    category: input.category,
    price: input.price,
    image_path: input.imagePath ?? null,
    in_stock: input.inStock,
    signature: input.signature,
  });
  if (error) throw error;
}

export async function updateProduct(
  productId: string,
  input: ProductInput
): Promise<void> {
  const supabase = await requireAdminSession();
  const { data, error } = await supabase
    .from(DIEGO_TABLES.products)
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      category: input.category,
      price: input.price,
      image_path: input.imagePath ?? null,
      in_stock: input.inStock,
      signature: input.signature,
    })
    .eq("id", productId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Product update was not authorized.");
}

export async function deleteProduct(productId: string): Promise<void> {
  const supabase = await requireAdminSession();

  // Récupère le chemin de l'image avant la suppression pour nettoyer le storage.
  const { data: existing } = await supabase
    .from(DIEGO_TABLES.products)
    .select("image_path")
    .eq("id", productId)
    .maybeSingle();

  const { data, error } = await supabase
    .from(DIEGO_TABLES.products)
    .update({ active: false, image_path: null })
    .eq("id", productId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Product deletion was not authorized.");

  const imagePath = (existing as { image_path: string | null } | null)
    ?.image_path;
  if (imagePath) {
    // Nettoyage best-effort : la suppression du produit reste valide même si
    // le fichier a déjà disparu du storage.
    await deleteProductImage(imagePath).catch(() => undefined);
  }
}

export async function uploadProductImage(file: File): Promise<string> {
  const supabase = await requireAdminSession();
  const compressed = await compressImage(file);
  const extension =
    compressed.type === "image/webp"
      ? "webp"
      : compressed.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `products/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(DIEGO_STORAGE_BUCKET)
    .upload(path, compressed, {
      cacheControl: "3600",
      upsert: false,
      contentType: compressed.type || undefined,
    });
  if (error) throw error;
  return path;
}

export async function deleteProductImage(imagePath: string): Promise<void> {
  const supabase = await requireAdminSession();
  const { error } = await supabase.storage
    .from(DIEGO_STORAGE_BUCKET)
    .remove([imagePath]);
  if (error) throw error;
}

export async function fetchRestaurantTables(): Promise<RestaurantTable[]> {
  const supabase = await requireAuthenticatedSession();
  const { data, error } = await supabase
    .from(DIEGO_TABLES.restaurantTables)
    .select("id,label,seats,status,position_x,position_y,qr_token")
    .eq("active", true)
    .order("label");

  if (error) throw error;
  return ((data ?? []) as TableRow[]).map((row) => ({
    id: row.id,
    label: row.label,
    seats: row.seats,
    status: row.status,
    x: Number(row.position_x),
    y: Number(row.position_y),
    qrToken: row.qr_token,
  }));
}

export async function setRestaurantTableStatus(
  tableId: string,
  status: TableStatus
): Promise<void> {
  const { data, error } = await requireSupabase()
    .from(DIEGO_TABLES.restaurantTables)
    .update({ status })
    .eq("id", tableId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Table update was not authorized.");
}

export type RestaurantTableInput = {
  label: string;
  seats: number;
  status: TableStatus;
};

export async function createRestaurantTable(
  input: RestaurantTableInput
): Promise<void> {
  const supabase = await requireAdminSession();
  const { data, error } = await supabase
    .from(DIEGO_TABLES.restaurantTables)
    .insert({
      label: input.label.trim(),
      seats: input.seats,
      status: input.status,
    })
    .select("id")
    .single();
  if (error) throw error;
  if (!data) throw new Error("Supabase did not persist the new table.");
}

export async function updateRestaurantTable(
  tableId: string,
  input: RestaurantTableInput
): Promise<void> {
  const supabase = await requireAdminSession();
  const { data, error } = await supabase
    .from(DIEGO_TABLES.restaurantTables)
    .update({
      label: input.label.trim(),
      seats: input.seats,
      status: input.status,
    })
    .eq("id", tableId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Table update was not authorized.");
}

export async function deleteRestaurantTable(tableId: string): Promise<void> {
  const supabase = await requireAdminSession();
  const { data, error } = await supabase
    .from(DIEGO_TABLES.restaurantTables)
    .update({ active: false })
    .eq("id", tableId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Table deletion was not authorized.");
}

async function fetchOrdersByScope(includeClosed: boolean): Promise<Order[]> {
  const supabase = await requireAuthenticatedSession();
  let query = supabase
    .from(DIEGO_TABLES.orders)
    .select(
      "id,order_number,customer_id,channel,status,restaurant_table_id,customer_phone,delivery_address,payment_method,payment_status,total,note,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(includeClosed ? 1000 : 100);

  if (!includeClosed) {
    query = query.in("status", ["en_attente", "preparation", "pret"]);
  }

  const { data: orderData, error: orderError } = await query;

  if (orderError) throw orderError;
  const rows = (orderData ?? []) as OrderRow[];
  if (rows.length === 0) return [];

  const tableIds = rows
    .map((row) => row.restaurant_table_id)
    .filter((id): id is string => Boolean(id));

  const [itemsResult, tablesResult] = await Promise.all([
    supabase
      .from(DIEGO_TABLES.orderItems)
      .select(
        "id,order_id,product_id,product_name,unit_price,quantity,note"
      )
      .in(
        "order_id",
        rows.map((row) => row.id)
      ),
    tableIds.length > 0
      ? supabase
          .from(DIEGO_TABLES.restaurantTables)
          .select("id,label")
          .in("id", tableIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (itemsResult.error) throw itemsResult.error;
  if (tablesResult.error) throw tablesResult.error;

  const items = (itemsResult.data ?? []) as OrderItemRow[];
  const tableLabels = new Map(
    ((tablesResult.data ?? []) as { id: string; label: string }[]).map((row) => [
      row.id,
      row.label,
    ])
  );

  return rows.map((row) => ({
    id: row.id,
    number: row.order_number,
    customerId: row.customer_id ?? undefined,
    channel: row.channel,
    status: row.status,
    createdAt: row.created_at,
    note: row.note ?? undefined,
    paymentMethod: row.payment_method ?? undefined,
    paymentStatus: row.payment_status,
    total: row.total,
    restaurantTableId: row.restaurant_table_id ?? undefined,
    customerPhone: row.customer_phone ?? undefined,
    deliveryAddress: row.delivery_address ?? undefined,
    table: row.restaurant_table_id
      ? tableLabels.get(row.restaurant_table_id)
      : undefined,
    lines: items
      .filter((item) => item.order_id === row.id)
      .map((item) => ({
        qty: item.quantity,
        note: item.note ?? undefined,
        product: {
          id: item.product_id ?? item.id,
          name: item.product_name,
          category: "plats",
          price: item.unit_price,
          inStock: true,
          imageUrl: null,
        },
      })),
  }));
}

export function fetchOrders(): Promise<Order[]> {
  return fetchOrdersByScope(false);
}

export function fetchAllOrders(): Promise<Order[]> {
  return fetchOrdersByScope(true);
}

export async function setOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<void> {
  const { data, error } = await requireSupabase()
    .from(DIEGO_TABLES.orders)
    .update({ status })
    .eq("id", orderId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Order update was not authorized.");
}

/** Annule une commande et libère la table liée si elle existe. */
export async function cancelOrder(orderId: string): Promise<void> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from(DIEGO_TABLES.orders)
    .update({ status: "annule" })
    .eq("id", orderId)
    .select("id,restaurant_table_id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Order cancellation was not authorized.");

  const tableId = (data as { restaurant_table_id: string | null })
    .restaurant_table_id;
  if (tableId) {
    await setRestaurantTableStatus(tableId, "libre");
  }
}

export async function setOrderPaymentStatus(
  orderId: string,
  status: PaymentStatus
): Promise<void> {
  const { data, error } = await requireSupabase()
    .from(DIEGO_TABLES.orders)
    .update({ payment_status: status })
    .eq("id", orderId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Payment update was not authorized.");
}

/** Remplace les lignes d'une commande web encore à valider. */
export async function replacePendingOrderItems(
  orderId: string,
  items: { productId: string; quantity: number; note?: string }[],
  note?: string
): Promise<void> {
  const { error } = await requireSupabase().rpc(
    "diego_replace_pending_order_items",
    {
      p_order_id: orderId,
      p_note: note ?? null,
      p_items: items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        note: item.note ?? null,
      })),
    }
  );
  if (error) throw error;
}

/** Valide une commande web → envoie en cuisine (en_attente). */
export async function validateCustomerOrder(orderId: string): Promise<void> {
  const { error } = await requireSupabase().rpc(
    "diego_validate_customer_order",
    { p_order_id: orderId }
  );
  if (error) throw error;
}

/** Assigne (ou retire) une table à une commande existante. */
export async function assignOrderTable(
  orderId: string,
  restaurantTableId: string | null
): Promise<void> {
  const supabase = requireSupabase();
  const { data: existing, error: readError } = await supabase
    .from(DIEGO_TABLES.orders)
    .select("id,restaurant_table_id")
    .eq("id", orderId)
    .maybeSingle();

  if (readError) throw readError;
  if (!existing) throw new Error("Commande introuvable.");

  const previousTableId = (
    existing as { restaurant_table_id: string | null }
  ).restaurant_table_id;

  const { data, error } = await supabase
    .from(DIEGO_TABLES.orders)
    .update({
      restaurant_table_id: restaurantTableId,
      ...(restaurantTableId ? { channel: "table" } : {}),
    })
    .eq("id", orderId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Assignation de table refusée.");

  if (previousTableId && previousTableId !== restaurantTableId) {
    await setRestaurantTableStatus(previousTableId, "libre");
  }
  if (restaurantTableId) {
    await setRestaurantTableStatus(restaurantTableId, "occupee");
  }
}

export type PosOrderInput = {
  channel: OrderChannel;
  payment: PaymentMethod;
  restaurantTableId?: string;
  note?: string;
  items: { productId: string; quantity: number; note?: string }[];
};

export type CreatedPosOrder = {
  id: string;
  orderNumber: number;
  total: number;
};

export async function createPosOrder(
  input: PosOrderInput
): Promise<CreatedPosOrder> {
  const { data, error } = await requireSupabase().rpc("diego_create_pos_order", {
    p_channel: input.channel,
    p_payment_method: input.payment,
    p_restaurant_table_id: input.restaurantTableId ?? null,
    p_note: input.note ?? null,
    p_items: input.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      note: item.note ?? null,
    })),
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Supabase did not return the created POS order.");

  return {
    id: row.id,
    orderNumber: row.order_number,
    total: row.total,
  };
}

export function subscribeToRestaurantChanges(
  onChange: () => void
): RealtimeChannel | null {
  const supabase = getSupabase();
  if (!supabase) return null;

  return supabase
    .channel("diego-restaurant-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: DIEGO_TABLES.products },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: DIEGO_TABLES.menuCategories },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: DIEGO_TABLES.restaurantTables },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: DIEGO_TABLES.orders },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: DIEGO_TABLES.orderItems },
      onChange
    )
    .subscribe();
}

export async function removeRealtimeChannel(
  channel: RealtimeChannel | null
): Promise<void> {
  const supabase = getSupabase();
  if (supabase && channel) await supabase.removeChannel(channel);
}
