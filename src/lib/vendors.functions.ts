import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  formatMoroccoPhoneForPayload,
  isValidMoroccoPhone,
  normalizeMoroccoPhoneInput,
} from "@/lib/morocco-phone";

export interface AdminVendorRecord {
  id: string;
  storeName: string;
  ownerName: string;
  phoneNumber: string;
  vendorType: "general" | "specialized";
  assignedCategories: string[];
  neighborhoodIds: string[];
  zone: string;
  status: "Active" | "Offline";
  createdAt?: string;
}

interface VendorRow {
  id: string;
  store_name: string;
  owner_name: string;
  phone_number: string;
  vendor_type: "general" | "specialized";
  assigned_categories: string[];
  is_active: boolean;
  created_at: string | null;
}

interface NeighborhoodRow {
  id: string;
  name: string;
  commune_id: string;
  vendor_id: string | null;
}

interface CommuneRow {
  id: string;
  name: string;
}

const createVendorInputSchema = z.object({
  storeName: z.string().trim().min(1).max(120),
  ownerName: z.string().trim().min(1).max(120),
  phoneNumber: z.string().trim().min(1).max(20),
  vendorType: z.enum(["general", "specialized"]).default("general"),
  assignedCategories: z.array(z.string()).default([]),
  neighborhoodIds: z.array(z.string().uuid()).min(1),
  isActive: z.boolean(),
});

const updateVendorDetailsInputSchema = z.object({
  vendorId: z.string().uuid(),
  storeName: z.string().trim().min(1).max(120),
  ownerName: z.string().trim().min(1).max(120),
  phoneNumber: z.string().trim().regex(/^\+212[0-9]{9}$/),
  vendorType: z.enum(["general", "specialized"]).default("general"),
  assignedCategories: z.array(z.string()).default([]),
  neighborhoodIds: z.array(z.string().uuid()).min(1),
});

const updateVendorActiveStateInputSchema = z.object({
  vendorId: z.string().uuid(),
  isActive: z.boolean(),
});

const getVendorSalesAnalyticsInputSchema = z.object({
  vendorId: z.string().uuid(),
});

type VendorOrderRow = {
  id: string;
  status: string;
  total_price: number;
  created_at: string;
};

export type VendorSalesAnalytics = {
  todaysRevenueMad: number;
  totalAllTimeSalesMad: number;
  totalCompletedOrders: number;
  lastFiveOrders: Array<{
    id: string;
    status: string;
    totalMad: number;
    createdAt: string;
  }>;
};

function zoneFromNeighborhoods(neighborhoods: NeighborhoodRow[], communeMap: Map<string, string>) {
  if (neighborhoods.length === 0) {
    return "Unassigned";
  }

  return neighborhoods
    .map((neighborhood) => {
      const communeName = communeMap.get(neighborhood.commune_id);
      return communeName ? `${communeName} / ${neighborhood.name}` : neighborhood.name;
    })
    .join(" • ");
}

async function assertNeighborhoodsAvailable(neighborhoodIds: string[], currentVendorId?: string) {
  const conflictQuery = (supabaseAdmin as any)
    .from("neighborhoods")
    .select("id, name, vendor_id")
    .in("id", neighborhoodIds)
    .not("vendor_id", "is", null);

  if (currentVendorId) {
    conflictQuery.neq("vendor_id", currentVendorId);
  }

  const { data: conflicts, error } = await conflictQuery;

  if (error) {
    throw new Error(error.message);
  }

  if ((conflicts ?? []).length > 0) {
    const claimed = (conflicts as Array<{ name: string }>).map((row) => row.name).join(", ");
    throw new Error(`These neighborhoods are already claimed: ${claimed}`);
  }
}

async function assignVendorNeighborhoods(vendorId: string, neighborhoodIds: string[]) {
  await assertNeighborhoodsAvailable(neighborhoodIds, vendorId);

  const { error: clearError } = await (supabaseAdmin as any)
    .from("neighborhoods")
    .update({ vendor_id: null })
    .eq("vendor_id", vendorId);

  if (clearError) {
    throw new Error(clearError.message);
  }

  const { error: assignError } = await (supabaseAdmin as any)
    .from("neighborhoods")
    .update({ vendor_id: vendorId })
    .in("id", neighborhoodIds);

  if (assignError) {
    throw new Error(assignError.message);
  }
}

async function fetchVendorRecord(vendorId: string) {
  const [{ data: vendor, error: vendorError }, { data: neighborhoods, error: neighborhoodsError }, { data: communes, error: communesError }] =
    await Promise.all([
      (supabaseAdmin as any)
        .from("vendors")
        .select("id, store_name, owner_name, phone_number, is_active, created_at")
        .eq("id", vendorId)
        .single(),
      (supabaseAdmin as any)
        .from("neighborhoods")
        .select("id, name, commune_id, vendor_id")
        .eq("vendor_id", vendorId)
        .order("name", { ascending: true }),
      (supabaseAdmin as any).from("communes").select("id, name"),
    ]);

  if (vendorError || !vendor?.id) {
    throw new Error(vendorError?.message ?? "Vendor not found.");
  }

  if (neighborhoodsError) {
    throw new Error(neighborhoodsError.message);
  }

  if (communesError) {
    throw new Error(communesError.message);
  }

  const communeMap = new Map(((communes ?? []) as CommuneRow[]).map((c) => [c.id, c.name]));
  const vendorNeighborhoods = (neighborhoods ?? []) as NeighborhoodRow[];
  const row = vendor as VendorRow;

  return {
    id: row.id,
    storeName: row.store_name,
    ownerName: row.owner_name,
    phoneNumber: row.phone_number,
    neighborhoodIds: vendorNeighborhoods.map((n) => n.id),
    zone: zoneFromNeighborhoods(vendorNeighborhoods, communeMap),
    status: row.is_active ? "Active" : "Offline",
    createdAt: row.created_at ?? undefined,
  } satisfies AdminVendorRecord;
}

export const listVendors = createServerFn({ method: "GET" }).handler(async () => {
  const [{ data: vendors, error: vendorsError }, { data: neighborhoods, error: neighborhoodsError }, { data: communes, error: communesError }] =
    await Promise.all([
      (supabaseAdmin as any)
        .from("vendors")
        .select("id, store_name, owner_name, phone_number, is_active, created_at")
        .order("created_at", { ascending: false }),
      (supabaseAdmin as any).from("neighborhoods").select("id, name, commune_id, vendor_id"),
      (supabaseAdmin as any).from("communes").select("id, name"),
    ]);

  if (vendorsError) {
    throw new Error(`Failed to fetch vendors: ${vendorsError.message}`);
  }
  if (neighborhoodsError) {
    throw new Error(`Failed to fetch neighborhoods: ${neighborhoodsError.message}`);
  }
  if (communesError) {
    throw new Error(`Failed to fetch communes: ${communesError.message}`);
  }

  const communeMap = new Map(((communes ?? []) as CommuneRow[]).map((c) => [c.id, c.name]));
  const neighborhoodsByVendor = new Map<string, NeighborhoodRow[]>();

  for (const neighborhood of (neighborhoods ?? []) as NeighborhoodRow[]) {
    if (!neighborhood.vendor_id) continue;
    const current = neighborhoodsByVendor.get(neighborhood.vendor_id) ?? [];
    current.push(neighborhood);
    neighborhoodsByVendor.set(neighborhood.vendor_id, current);
  }

  return ((vendors ?? []) as VendorRow[]).map((vendor): AdminVendorRecord => {
    const vendorNeighborhoods = neighborhoodsByVendor.get(vendor.id) ?? [];

    return {
      id: vendor.id,
      storeName: vendor.store_name,
      ownerName: vendor.owner_name,
      phoneNumber: vendor.phone_number,
      neighborhoodIds: vendorNeighborhoods.map((neighborhood) => neighborhood.id),
      zone: zoneFromNeighborhoods(vendorNeighborhoods, communeMap),
      status: vendor.is_active ? "Active" : "Offline",
      createdAt: vendor.created_at ?? undefined,
    };
  });
});

export const createVendor = createServerFn({ method: "POST" })
  .inputValidator((input) => createVendorInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const normalizedPhone = normalizeMoroccoPhoneInput(data.phoneNumber);

      if (!isValidMoroccoPhone(normalizedPhone)) {
        throw new Error("Phone number must be exactly 9 digits.");
      }

      const payloadPhoneNumber = formatMoroccoPhoneForPayload(normalizedPhone);
      await assertNeighborhoodsAvailable(data.neighborhoodIds);

      const { data: inserted, error } = await (supabaseAdmin as any)
        .from("vendors")
        .insert({
          store_name: data.storeName,
          owner_name: data.ownerName,
          phone_number: payloadPhoneNumber,
          is_active: data.isActive,
        })
        .select("id")
        .single();

      if (error || !inserted?.id) {
        throw new Error(error?.message ?? "Vendor insert failed.");
      }

      try {
        await assignVendorNeighborhoods(inserted.id as string, data.neighborhoodIds);
      } catch (territoryError) {
        await (supabaseAdmin as any).from("vendors").delete().eq("id", inserted.id as string);
        throw territoryError;
      }

      return await fetchVendorRecord(inserted.id as string);
    } catch (error) {
      console.error("createVendor failed:", error);
      throw new Error(error instanceof Error ? error.message : "Vendor save failed.");
    }
  });

export const updateVendorDetails = createServerFn({ method: "POST" })
  .inputValidator((input) => updateVendorDetailsInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      await assertNeighborhoodsAvailable(data.neighborhoodIds, data.vendorId);

      const { data: updated, error } = await (supabaseAdmin as any)
        .from("vendors")
        .update({
          store_name: data.storeName,
          owner_name: data.ownerName,
          phone_number: data.phoneNumber,
        })
        .eq("id", data.vendorId)
        .select("id")
        .single();

      if (error || !updated?.id) {
        throw new Error(error?.message ?? "Vendor update failed.");
      }

      await assignVendorNeighborhoods(data.vendorId, data.neighborhoodIds);

      return await fetchVendorRecord(data.vendorId);
    } catch (error) {
      console.error("updateVendorDetails failed:", error);
      throw new Error(error instanceof Error ? error.message : "Vendor update failed.");
    }
  });

export const updateVendorActiveState = createServerFn({ method: "POST" })
  .inputValidator((input) => updateVendorActiveStateInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { error } = await (supabaseAdmin as any)
        .from("vendors")
        .update({ is_active: data.isActive })
        .eq("id", data.vendorId);

      if (error) {
        throw new Error(error.message);
      }

      return { ok: true, isActive: data.isActive };
    } catch (error) {
      console.error("updateVendorActiveState failed:", error);
      throw new Error("Failed to update vendor visibility.");
    }
  });

export const getVendorSalesAnalytics = createServerFn({ method: "POST" })
  .inputValidator((input) => getVendorSalesAnalyticsInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      const endOfToday = new Date(startOfToday);
      endOfToday.setUTCDate(endOfToday.getUTCDate() + 1);

      const [
        { data: deliveredOrders, error: deliveredOrdersError },
        { data: deliveredOrdersToday, error: deliveredOrdersTodayError },
        { data: recentOrders, error: recentOrdersError },
      ] = await Promise.all([
        (supabaseAdmin as any)
          .from("orders")
          .select("id, total_price")
          .eq("vendor_id", data.vendorId)
          .eq("status", "delivered"),
        (supabaseAdmin as any)
          .from("orders")
          .select("id, total_price")
          .eq("vendor_id", data.vendorId)
          .eq("status", "delivered")
          .gte("created_at", startOfToday.toISOString())
          .lt("created_at", endOfToday.toISOString()),
        (supabaseAdmin as any)
          .from("orders")
          .select("id, status, total_price, created_at")
          .eq("vendor_id", data.vendorId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (deliveredOrdersError) {
        throw new Error(deliveredOrdersError.message);
      }

      if (deliveredOrdersTodayError) {
        throw new Error(deliveredOrdersTodayError.message);
      }

      if (recentOrdersError) {
        throw new Error(recentOrdersError.message);
      }

      const allTimeDeliveredRows = (deliveredOrders ?? []) as Array<{ total_price: number }>;
      const todaysDeliveredRows = (deliveredOrdersToday ?? []) as Array<{ total_price: number }>;

      const totalAllTimeSalesMad = allTimeDeliveredRows.reduce(
        (sum, row) => sum + Number(row.total_price ?? 0),
        0,
      );

      const todaysRevenueMad = todaysDeliveredRows.reduce(
        (sum, row) => sum + Number(row.total_price ?? 0),
        0,
      );

      return {
        todaysRevenueMad,
        totalAllTimeSalesMad,
        totalCompletedOrders: allTimeDeliveredRows.length,
        lastFiveOrders: ((recentOrders ?? []) as VendorOrderRow[]).map((order) => ({
          id: order.id,
          status: order.status,
          totalMad: Number(order.total_price ?? 0),
          createdAt: order.created_at,
        })),
      } satisfies VendorSalesAnalytics;
    } catch (error) {
      console.error("getVendorSalesAnalytics failed:", error);
      throw new Error("Failed to load vendor sales analytics.");
    }
  });
