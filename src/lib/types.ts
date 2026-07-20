export type Category = string;

export interface MenuCategory {
  id: string;
  slug: string;
  label: string;
  sortOrder: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  category: Category;
  price: number; // FCFA
  inStock: boolean;
  imageUrl?: string | null;
  imagePath?: string | null;
  signature?: boolean;
}

export type OrderChannel = "comptoir" | "table" | "emporter" | "livraison";

export type OrderStatus =
  | "a_valider"
  | "en_attente"
  | "preparation"
  | "pret"
  | "servi"
  | "en_livraison"
  | "livre"
  | "annule";

export type PaymentStatus = "en_attente" | "paye" | "echoue" | "rembourse";

export interface OrderLine {
  product: Product;
  qty: number;
  note?: string;
}

export interface Order {
  id: string;
  number: number;
  customerId?: string;
  channel: OrderChannel;
  status: OrderStatus;
  lines: OrderLine[];
  createdAt: string;
  table?: string;
  restaurantTableId?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  note?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus: PaymentStatus;
  total: number;
}

export type TableStatus = "libre" | "occupee" | "reservee";

export interface RestaurantTable {
  id: string;
  label: string;
  seats: number;
  status: TableStatus;
  x: number; // position en % dans le plan de salle
  y: number;
  qrToken: string;
}

export type PaymentMethod = "especes" | "mobile_money" | "carte";
