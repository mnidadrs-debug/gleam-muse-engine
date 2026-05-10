export interface EntityBase {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorEntity extends EntityBase {
  storeName: string;
  ownerName: string;
  phoneNumber: string;
  zone: string;
  status: "Active" | "Offline";
}

export interface MasterProductEntity extends EntityBase {
  name: string;
  nameFr?: string | null;
  nameAr?: string | null;
  categoryId?: string | null;
  category: string;
  measurementUnit: "Kg" | "Liter" | "Piece" | "Pack";
  popularityScore?: number;
  imageUrl?: string | null;
  isActive?: boolean;
}

export interface OrderEntity extends EntityBase {
  customerName: string;
  customerPhone: string;
  deliveryNotes: string;
  status: "pending" | "confirmed" | "delivering" | "completed";
  totalMad: number;
  itemCount: number;
  userId?: string;
}

export interface UserEntity extends EntityBase {
  fullName: string;
  phoneNumber: string;
  role: "customer" | "vendor" | "admin";
}

export function createEntityId() {
  return crypto.randomUUID();
}
