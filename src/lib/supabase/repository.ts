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
import { fetchCurrentRole, isAdminRole, isStaffRole } from "@/lib/auth";
import { compressImage } from "@/lib/image";

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  category: Category;
  price: number;
  image_path: string | null;
  in_stock: boolean;
  stock_qty: number;
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
    stockQty: row.stock_qty ?? 0,
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
      "id,name,description,category,price,image_path,in_stock,stock_qty,signature,sort_order"
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
  const supabase = await requireAdminSession();
  const { data, error } = await supabase
    .from(DIEGO_TABLES.products)
    .update({
      in_stock: inStock,
      ...(inStock ? {} : { stock_qty: 0 }),
    })
    .eq("id", productId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Product update was not authorized.");
}

/** Fixe la quantité de stock d'une boisson (admin uniquement). */
export async function setDrinkStockQty(
  productId: string,
  qty: number
): Promise<void> {
  const supabase = await requireAdminSession();
  const { error } = await supabase.rpc("diego_set_drink_stock_qty", {
    p_product_id: productId,
    p_qty: Math.max(0, Math.floor(qty)),
  });
  if (error) throw error;
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
  const productIds = Array.from(
    new Set(
      items
        .map((item) => item.product_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const productCategories = new Map<string, string>();
  if (productIds.length > 0) {
    const { data: productsData, error: productsError } = await supabase
      .from(DIEGO_TABLES.products)
      .select("id,category")
      .in("id", productIds);
    if (productsError) throw productsError;
    for (const product of productsData ?? []) {
      productCategories.set(
        String((product as { id: string }).id),
        String((product as { category: string }).category)
      );
    }
  }

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
          category:
            (item.product_id && productCategories.get(item.product_id)) ||
            "accompagnements",
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

/** Remplace les lignes d'une vente POS encore non payée. */
export async function replaceUnpaidPosOrderItems(input: {
  orderId: string;
  items: { productId: string; quantity: number; note?: string }[];
  note?: string;
  payment?: PaymentMethod;
  restaurantTableId?: string | null;
  channel?: OrderChannel;
}): Promise<number> {
  const supabase = await requireAuthenticatedSession();
  const role = await fetchCurrentRole();
  if (!isStaffRole(role)) {
    throw new Error(
      "Compte staff requis (superAdmin, admin ou caissier) enregistré dans Diego."
    );
  }

  if (input.items.length === 0) {
    throw new Error("Ajoutez au moins un article.");
  }

  const { data, error } = await supabase.rpc(
    "diego_replace_unpaid_pos_order_items",
    {
      p_order_id: input.orderId,
      p_note: input.note ?? null,
      p_payment_method: input.payment ?? null,
      p_restaurant_table_id: input.restaurantTableId ?? null,
      p_channel: input.channel ?? null,
      p_items: input.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        note: item.note ?? null,
      })),
    }
  );

  if (!error) {
    const total = Number(data);
    return Number.isFinite(total) ? total : 0;
  }

  const missingFn =
    /could not find|function .* does not exist|pgrst202/i.test(
      error.message ?? ""
    ) || error.code === "PGRST202";

  if (!missingFn) {
    throw new Error(mapPosOrderError(error.message));
  }

  return replaceUnpaidPosOrderItemsDirect(supabase, input);
}

async function replaceUnpaidPosOrderItemsDirect(
  supabase: ReturnType<typeof requireSupabase>,
  input: {
    orderId: string;
    items: { productId: string; quantity: number; note?: string }[];
    note?: string;
    payment?: PaymentMethod;
    restaurantTableId?: string | null;
    channel?: OrderChannel;
  }
): Promise<number> {
  const { data: order, error: orderError } = await supabase
    .from(DIEGO_TABLES.orders)
    .select("id,payment_status,status,restaurant_table_id,channel")
    .eq("id", input.orderId)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!order) throw new Error("Commande introuvable.");

  const row = order as {
    payment_status: string;
    status: string;
    restaurant_table_id: string | null;
    channel: OrderChannel;
  };

  if (row.status === "annule") {
    throw new Error("Une commande annulée ne peut pas être modifiée.");
  }
  if (row.payment_status !== "en_attente") {
    throw new Error("Seules les ventes non payées peuvent être modifiées.");
  }

  const productIds = input.items.map((item) => item.productId);
  const { data: products, error: productsError } = await supabase
    .from(DIEGO_TABLES.products)
    .select("id,name,price,active")
    .in("id", productIds);

  if (productsError) throw productsError;

  const byId = new Map(
    (products ?? []).map((product) => [
      String((product as { id: string }).id),
      product as { id: string; name: string; price: number; active: boolean },
    ])
  );

  const lines = input.items.map((item) => {
    const product = byId.get(item.productId);
    if (!product?.active || item.quantity < 1 || item.quantity > 99) {
      throw new Error(
        "Un ou plusieurs produits sont invalides ou indisponibles."
      );
    }
    return {
      order_id: input.orderId,
      product_id: product.id,
      product_name: product.name,
      unit_price: product.price,
      quantity: item.quantity,
      note: item.note ?? null,
    };
  });

  const { error: deleteError } = await supabase
    .from(DIEGO_TABLES.orderItems)
    .delete()
    .eq("order_id", input.orderId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase
    .from(DIEGO_TABLES.orderItems)
    .insert(lines);
  if (insertError) throw insertError;

  const total = lines.reduce(
    (sum, line) => sum + line.unit_price * line.quantity,
    0
  );
  const nextChannel = input.channel ?? row.channel;
  const nextTableId =
    nextChannel === "livraison" ? null : (input.restaurantTableId ?? null);

  const { error: updateError } = await supabase
    .from(DIEGO_TABLES.orders)
    .update({
      note: input.note ?? null,
      payment_method: input.payment ?? undefined,
      channel: nextChannel,
      restaurant_table_id: nextTableId,
      subtotal: total,
      total,
    })
    .eq("id", input.orderId);
  if (updateError) throw updateError;

  if (
    row.restaurant_table_id &&
    row.restaurant_table_id !== nextTableId
  ) {
    await setRestaurantTableStatus(row.restaurant_table_id, "libre");
  }
  if (nextTableId) {
    await setRestaurantTableStatus(nextTableId, "occupee");
  }

  return total;
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
  const supabase = await requireAuthenticatedSession();
  const role = await fetchCurrentRole();
  if (!isStaffRole(role)) {
    throw new Error(
      "Compte staff requis (superAdmin, admin ou caissier) enregistré dans Diego."
    );
  }

  const { data, error } = await supabase.rpc("diego_create_pos_order", {
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

  if (error) throw new Error(mapPosOrderError(error.message));
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Supabase did not return the created POS order.");

  const record = row as Record<string, unknown>;
  const id = String(record.order_id ?? record.id ?? "");
  const orderNumber = Number(record.order_number);
  const total = Number(record.order_total ?? record.total);
  if (!id || !Number.isFinite(orderNumber)) {
    throw new Error("Supabase did not return the created POS order.");
  }

  return {
    id,
    orderNumber,
    total: Number.isFinite(total) ? total : 0,
  };
}

function mapPosOrderError(message: string | undefined): string {
  const raw = (message ?? "").trim();
  const lower = raw.toLowerCase();
  if (
    lower.includes("staff authentication required") ||
    lower.includes("staff only")
  ) {
    return "Session staff invalide. Reconnectez-vous avec un compte Diego (superAdmin, admin ou caissier).";
  }
  if (
    lower.includes("invalid or unavailable") ||
    lower.includes("unavailable")
  ) {
    return "Un ou plusieurs produits sont indisponibles ou en rupture de stock.";
  }
  if (lower.includes("invalid payment")) {
    return "Moyen de paiement invalide.";
  }
  if (lower.includes("invalid pos order channel")) {
    return "Canal de commande invalide.";
  }
  if (lower.includes("invalid restaurant table")) {
    return "Table introuvable.";
  }
  if (lower.includes("at least one item")) {
    return "Ajoutez au moins un article.";
  }
  if (lower.includes("only unpaid sales can be edited")) {
    return "Seules les ventes non payées peuvent être modifiées.";
  }
  if (lower.includes("cancelled orders cannot be edited")) {
    return "Une commande annulée ne peut pas être modifiée.";
  }
  if (lower.includes("one or more products are invalid")) {
    return "Un ou plusieurs produits sont invalides ou indisponibles.";
  }
  if (lower.includes("ambiguous")) {
    return "Erreur base de données (colonne ambigüe). Appliquez la migration fix_pos_order_ambiguous_id.";
  }
  return raw || "Commande refusée.";
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

export type Expense = {
  id: string;
  label: string;
  amount: number;
  category?: string;
  note?: string;
  expenseDate: string;
  createdAt: string;
};

type ExpenseRow = {
  id: string;
  label: string;
  amount: number;
  category: string | null;
  note: string | null;
  expense_date: string;
  created_at: string;
};

export async function fetchExpenses(): Promise<Expense[]> {
  const supabase = await requireAuthenticatedSession();
  const { data, error } = await supabase
    .from(DIEGO_TABLES.expenses)
    .select("id,label,amount,category,note,expense_date,created_at")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  return ((data ?? []) as ExpenseRow[]).map((row) => ({
    id: row.id,
    label: row.label,
    amount: row.amount,
    category: row.category ?? undefined,
    note: row.note ?? undefined,
    expenseDate: row.expense_date,
    createdAt: row.created_at,
  }));
}

export type ExpenseInput = {
  label: string;
  amount: number;
  category?: string;
  note?: string;
  expenseDate?: string;
};

export async function createExpense(input: ExpenseInput): Promise<void> {
  const supabase = await requireAdminSession();
  const { data, error } = await supabase
    .from(DIEGO_TABLES.expenses)
    .insert({
      label: input.label.trim(),
      amount: input.amount,
      category: input.category?.trim() || null,
      note: input.note?.trim() || null,
      expense_date: input.expenseDate ?? new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Création de dépense refusée.");
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const supabase = await requireAdminSession();
  const { data, error } = await supabase
    .from(DIEGO_TABLES.expenses)
    .delete()
    .eq("id", expenseId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Suppression refusée.");
}
