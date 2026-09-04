export type TableStatus = "disponible" | "reservada" | "ocupada" | "mantenimiento";
export type ReservationSource = "whatsapp" | "voice" | "web" | "manual";
export type OrderStatus = "pendiente" | "en_preparacion" | "servido" | "pagado";
export type TableShape = "round" | "square" | "rectangle";

export interface Zone {
  id: string;
  name: string;
  icon?: string;
  description?: string;
}

export interface OrderItem {
  id: string;
  name: string;
  category: "entrante" | "principal" | "postre" | "bebida" | "especial";
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export interface IAConversationSummary {
  channel: ReservationSource;
  timestamp: string;
  summary: string;
  guestsCount: number;
  dietaryRestrictions?: string[];
  specialRequests?: string;
  aiAgentName: string;
  confidenceScore: number;
  keyTopics: string[];
}

export interface CustomerInfo {
  name: string;
  phone: string;
  email?: string;
  isVip?: boolean;
  notes?: string;
}

export interface Table {
  id: string;
  number: number;
  name: string;
  capacity: number;
  zone: string; // Dynamic Zone ID (e.g. "terraza", "salon_principal", "vip", "pub_bar", etc.)
  status: TableStatus;
  position: { x: number; y: number }; // Percentage (0-100) on canvas
  shape: TableShape;
  currentReservationId?: string;
}

export interface Reservation {
  id: string;
  tableId: string;
  tableNumber: number;
  customer: CustomerInfo;
  dateTime: string;
  guestsCount: number;
  status: TableStatus;
  orderStatus: OrderStatus;
  iaSummary: IAConversationSummary;
  items: OrderItem[];
  totalAmount: number;
  createdVia: ReservationSource;
}
