import { createEntityId, type EntityBase } from "@/lib/entities";

export type VendorOrderStatus =
  | "placed"
  | "vendor_accepted"
  | "preparing"
  | "ready_for_pickup"
  | "vendor_rejected";

export interface VendorOrderItem extends EntityBase {
  name: string;
  quantity: number;
  unitPriceMad: number;
}

export interface VendorOrder extends EntityBase {
  customerName: string;
  status: VendorOrderStatus;
  items: VendorOrderItem[];
  totalMad: number;
}

export interface CreateVendorOrderInput {
  customerName: string;
  status: VendorOrderStatus;
  items: VendorOrderItem[];
  totalMad: number;
}

export interface CreateVendorOrderItemInput {
  name: string;
  quantity: number;
  unitPriceMad: number;
}

const ALLOWED_TRANSITIONS: Record<VendorOrderStatus, VendorOrderStatus[]> = {
  placed: ["vendor_accepted", "vendor_rejected"],
  vendor_accepted: ["preparing"],
  preparing: ["ready_for_pickup"],
  ready_for_pickup: [],
  vendor_rejected: [],
};

export function canTransitionOrderStatus(current: VendorOrderStatus, next: VendorOrderStatus) {
  return ALLOWED_TRANSITIONS[current].includes(next);
}

export function transitionVendorOrder(order: VendorOrder, nextStatus: VendorOrderStatus) {
  if (!canTransitionOrderStatus(order.status, nextStatus)) {
    return order;
  }

  return {
    ...order,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  };
}

export function createVendorOrder(input: CreateVendorOrderInput): VendorOrder {
  const now = new Date().toISOString();
  return {
    ...input,
    id: createEntityId(),
    createdAt: now,
    updatedAt: now,
  };
}

export function createVendorOrderItem(input: CreateVendorOrderItemInput): VendorOrderItem {
  const now = new Date().toISOString();
  return {
    ...input,
    id: createEntityId(),
    createdAt: now,
    updatedAt: now,
  };
}
