import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const moroccoPhoneSchema = z.string().trim().regex(/^\+212[0-9]{9}$/);

const createCyclistInputSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  phoneNumber: moroccoPhoneSchema,
  neighborhoodIds: z.array(z.string().uuid()).min(1),
  isActive: z.boolean().default(true),
});

const cyclistLookupInputSchema = z.object({
  phoneNumber: moroccoPhoneSchema,
});

const cyclistDashboardInputSchema = z.object({
  cyclistId: z.string().uuid(),
});

const cyclistWalletInputSchema = z.object({
  cyclistId: z.string().uuid(),
});

const cyclistEarningsHistoryInputSchema = z.object({
  cyclistId: z.string().uuid(),
  period: z.enum(["today", "week", "month"]),
});

const setCyclistActiveStateInputSchema = z.object({
  cyclistId: z.string().uuid(),
  isActive: z.boolean(),
});

const acceptDeliveryInputSchema = z.object({
  cyclistId: z.string().uuid(),
  orderId: z.string().uuid(),
});

const markDeliveredInputSchema = z.object({
  cyclistId: z.string().uuid(),
  orderId: z.string().uuid(),
});

const verifyDeliveryInputSchema = z.object({
  cyclistId: z.string().uuid(),
  orderId: z.string().uuid(),
  deliveryAuthCode: z.string().trim().regex(/^\d{4,6}$/),
});

type CyclistRow = {
  id: string;
  full_name: string;
  phone_number: string;
  is_active: boolean;
  created_at: string;
};

type CyclistCoverageRow = {
  cyclist_id: string;
  neighborhood_id: string;
};

type NeighborhoodRow = {
  id: string;
  name: string;
  commune_id: string;
};

type CommuneRow = {
  id: string;
  name: string;
};

type OrderRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  delivery_notes: string;
  payment_method: "COD" | "Carnet";
  delivery_fee: number;
  total_price: number;
  status: "ready" | "delivering" | "delivered" | "new" | "preparing";
  neighborhood_id: string;
  delivery_auth_code: string;
  created_at: string;
  delivered_at?: string | null;
  vendor_settlement_status?: "pending" | "settled";
};

type CustomerRow = {
  phone_number: string;
  saved_instructions: string | null;
};

export type AdminCyclistRecord = {
  id: string;
  fullName: string;
  phoneNumber: string;
  neighborhoodIds: string[];
  zone: string;
  status: "Active" | "Offline";
  createdAt?: string;
};

export type CyclistOrderCard = {
  id: string;
  customerName: string;
  customerPhone: string;
  douar: string;
  deliveryFeeMad: number;
  totalMad: number;
  paymentMethod: "COD" | "Carnet";
  savedInstructions: string;
  deliveryNotes: string;
  deliveryAuthCode: string;
  createdAt: string;
};

export type CyclistWalletSummary = {
  cyclist: {
    id: string;
    fullName: string;
  };
  myEarningsMad: number;
  cashToRemitMad: number;
  deliveredTodayCount: number;
  pendingSettlementOrdersCount: number;
};

export type EarningsHistoryPeriod = "today" | "week" | "month";

export type CyclistEarningsHistoryEntry = {
  orderId: string;
  deliveredAt: string;
  deliveryFeeMad: number;
};

export type CyclistEarningsHistoryResponse = {
  period: EarningsHistoryPeriod;
  totalEarningsMad: number;
  deliveries: CyclistEarningsHistoryEntry[];
};

async function buildServiceZoneMaps() {
  const [{ data: neighborhoods, error: neighborhoodsError }, { data: communes, error: communesError }] =
    await Promise.all([
      (supabaseAdmin as any).from("neighborhoods").select("id, name, commune_id"),
      (supabaseAdmin as any).from("communes").select("id, name"),
    ]);

  if (neighborhoodsError) {
    throw new Error(neighborhoodsError.message);
  }
  if (communesError) {
    throw new Error(communesError.message);
  }

  const communeMap = new Map(((communes ?? []) as CommuneRow[]).map((row) => [row.id, row.name]));
  const neighborhoodMap = new Map(
    ((neighborhoods ?? []) as NeighborhoodRow[]).map((row) => [row.id, row]),
  );

  return { communeMap, neighborhoodMap };
}

function formatCoverageZone(
  neighborhoodIds: string[],
  neighborhoodMap: Map<string, NeighborhoodRow>,
  communeMap: Map<string, string>,
) {
  if (neighborhoodIds.length === 0) {
    return "Unassigned";
  }

  const byCommune = new Map<string, string[]>();

  for (const neighborhoodId of neighborhoodIds) {
    const neighborhood = neighborhoodMap.get(neighborhoodId);
    if (!neighborhood) {
      continue;
    }

    const communeName = communeMap.get(neighborhood.commune_id) ?? "Unknown Commune";
    const current = byCommune.get(communeName) ?? [];
    current.push(neighborhood.name);
    byCommune.set(communeName, current);
  }

  const formatted = Array.from(byCommune.entries()).map(([communeName, neighborhoods]) => {
    const uniqueNeighborhoods = Array.from(new Set(neighborhoods));
    return `${communeName} / ${uniqueNeighborhoods.join(", ")}`;
  });

  return formatted.length ? formatted.join(" • ") : "Unassigned";
}

export const listCyclists = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { data: cyclists, error } = await (supabaseAdmin as any)
      .from("cyclists")
      .select("id, full_name, phone_number, is_active, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const cyclistRows = (cyclists ?? []) as CyclistRow[];
    const cyclistIds = cyclistRows.map((row) => row.id);

    const { data: coverageRows, error: coverageError } = cyclistIds.length
      ? await (supabaseAdmin as any)
          .from("cyclist_coverage")
          .select("cyclist_id, neighborhood_id")
          .in("cyclist_id", cyclistIds)
      : { data: [], error: null };

    if (coverageError) {
      throw new Error(coverageError.message);
    }

    const coverageByCyclist = new Map<string, string[]>();
    for (const row of (coverageRows ?? []) as CyclistCoverageRow[]) {
      const current = coverageByCyclist.get(row.cyclist_id) ?? [];
      current.push(row.neighborhood_id);
      coverageByCyclist.set(row.cyclist_id, current);
    }

    const { communeMap, neighborhoodMap } = await buildServiceZoneMaps();

    return cyclistRows.map((cyclist): AdminCyclistRecord => {
      const neighborhoodIds = Array.from(new Set(coverageByCyclist.get(cyclist.id) ?? []));

      return {
        id: cyclist.id,
        fullName: cyclist.full_name,
        phoneNumber: cyclist.phone_number,
        neighborhoodIds,
        zone: formatCoverageZone(neighborhoodIds, neighborhoodMap, communeMap),
        status: cyclist.is_active ? "Active" : "Offline",
        createdAt: cyclist.created_at ?? undefined,
      };
    });
  } catch (error) {
    console.error("listCyclists failed:", error);
    throw new Error("Failed to load cyclists.");
  }
});

export const createCyclist = createServerFn({ method: "POST" })
  .inputValidator((input) => createCyclistInputSchema.parse(input))
  .handler(async ({ data }) => {
    let insertedCyclistId: string | null = null;

    try {
      const uniqueNeighborhoodIds = Array.from(new Set(data.neighborhoodIds));

      const { data: inserted, error } = await (supabaseAdmin as any)
        .from("cyclists")
        .insert({
          full_name: data.fullName,
          phone_number: data.phoneNumber,
          is_active: data.isActive,
        })
        .select("id, full_name, phone_number, is_active, created_at")
        .single();

      if (error || !inserted?.id) {
        throw new Error(error?.message ?? "Cyclist insert failed.");
      }

      insertedCyclistId = inserted.id as string;

      const coveragePayload = uniqueNeighborhoodIds.map((neighborhoodId) => ({
        cyclist_id: insertedCyclistId,
        neighborhood_id: neighborhoodId,
      }));

      const { error: coverageInsertError } = await (supabaseAdmin as any)
        .from("cyclist_coverage")
        .insert(coveragePayload);

      if (coverageInsertError) {
        throw new Error(coverageInsertError.message);
      }

      const { communeMap, neighborhoodMap } = await buildServiceZoneMaps();
      const row = inserted as CyclistRow;

      return {
        id: row.id,
        fullName: row.full_name,
        phoneNumber: row.phone_number,
        neighborhoodIds: uniqueNeighborhoodIds,
        zone: formatCoverageZone(uniqueNeighborhoodIds, neighborhoodMap, communeMap),
        status: row.is_active ? "Active" : "Offline",
        createdAt: row.created_at ?? undefined,
      } satisfies AdminCyclistRecord;
    } catch (error) {
      if (insertedCyclistId) {
        await (supabaseAdmin as any).from("cyclists").delete().eq("id", insertedCyclistId);
      }

      console.error("createCyclist failed:", error);
      throw new Error("Cyclist save failed.");
    }
  });

export const getCyclistByPhone = createServerFn({ method: "POST" })
  .inputValidator((input) => cyclistLookupInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: cyclist, error } = await (supabaseAdmin as any)
        .from("cyclists")
        .select("id, full_name, phone_number, is_active")
        .eq("phone_number", data.phoneNumber)
        .single();

      if (error || !cyclist?.id) {
        throw new Error(error?.message ?? "Cyclist not found.");
      }

      return {
        id: cyclist.id as string,
        fullName: cyclist.full_name as string,
        phoneNumber: cyclist.phone_number as string,
        isActive: Boolean(cyclist.is_active),
      };
    } catch (error) {
      console.error("getCyclistByPhone failed:", error);
      throw new Error("Cyclist account not found.");
    }
  });

export const getCyclistDashboardData = createServerFn({ method: "POST" })
  .inputValidator((input) => cyclistDashboardInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: cyclist, error: cyclistError } = await (supabaseAdmin as any)
        .from("cyclists")
        .select("id, full_name, phone_number, is_active")
        .eq("id", data.cyclistId)
        .single();

      if (cyclistError || !cyclist?.id) {
        throw new Error(cyclistError?.message ?? "Cyclist not found.");
      }

      const { data: coverageRows, error: coverageError } = await (supabaseAdmin as any)
        .from("cyclist_coverage")
        .select("cyclist_id, neighborhood_id")
        .eq("cyclist_id", cyclist.id);

      if (coverageError) {
        throw new Error(coverageError.message);
      }

      const coverageNeighborhoodIds = Array.from(
        new Set(((coverageRows ?? []) as CyclistCoverageRow[]).map((row) => row.neighborhood_id)),
      );

      const [availableResult, activeResult, deliveredResult] = await Promise.all([
        coverageNeighborhoodIds.length
          ? (supabaseAdmin as any)
              .from("orders")
              .select(
                "id, customer_name, customer_phone, delivery_notes, payment_method, delivery_fee, total_price, status, neighborhood_id, delivery_auth_code, created_at",
              )
              .eq("status", "ready")
              .in("neighborhood_id", coverageNeighborhoodIds)
              .is("cyclist_id", null)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        (supabaseAdmin as any)
          .from("orders")
          .select(
            "id, customer_name, customer_phone, delivery_notes, payment_method, delivery_fee, total_price, status, neighborhood_id, delivery_auth_code, created_at",
          )
          .eq("status", "delivering")
          .eq("cyclist_id", cyclist.id)
          .order("created_at", { ascending: false }),
        (supabaseAdmin as any)
          .from("orders")
          .select("total_price, delivery_fee")
          .eq("status", "delivered")
          .eq("cyclist_id", cyclist.id),
      ]);

      const availableRows = availableResult.data;
      const availableError = availableResult.error;
      const activeRows = activeResult.data;
      const activeError = activeResult.error;
      const deliveredRows = deliveredResult.data;
      const deliveredError = deliveredResult.error;

      if (availableError) {
        throw new Error(availableError.message);
      }
      if (activeError) {
        throw new Error(activeError.message);
      }
      if (deliveredError) {
        throw new Error(deliveredError.message);
      }

      const allRows = [...((availableRows ?? []) as OrderRow[]), ...((activeRows ?? []) as OrderRow[])];
      const uniquePhones = Array.from(new Set(allRows.map((row) => row.customer_phone).filter(Boolean)));

      const { data: customers, error: customersError } = uniquePhones.length
        ? await (supabaseAdmin as any)
            .from("customers")
            .select("phone_number, saved_instructions")
            .in("phone_number", uniquePhones)
        : { data: [], error: null };

      if (customersError) {
        throw new Error(customersError.message);
      }

      const { neighborhoodMap } = await buildServiceZoneMaps();
      const customerInstructionMap = new Map(
        ((customers ?? []) as CustomerRow[]).map((customer) => [customer.phone_number, customer.saved_instructions]),
      );

      const mapOrder = (row: OrderRow): CyclistOrderCard => {
        const neighborhood = neighborhoodMap.get(row.neighborhood_id);
        const savedInstructions = customerInstructionMap.get(row.customer_phone) ?? row.delivery_notes ?? "";

        return {
          id: row.id,
          customerName: row.customer_name,
          customerPhone: row.customer_phone,
          douar: neighborhood?.name ?? "Unspecified",
          deliveryFeeMad: Number(row.delivery_fee ?? 0),
          totalMad: Number(row.total_price ?? 0) + Number(row.delivery_fee ?? 0),
          paymentMethod: row.payment_method === "Carnet" ? "Carnet" : "COD",
          savedInstructions,
          deliveryNotes: row.delivery_notes,
          deliveryAuthCode: row.delivery_auth_code,
          createdAt: row.created_at,
        };
      };

      const totalCashCollectedMad = ((deliveredRows ?? []) as Array<{ total_price: number; delivery_fee: number }>).reduce(
        (sum, row) => sum + Number(row.total_price ?? 0) + Number(row.delivery_fee ?? 0),
        0,
      );

      return {
        cyclist: {
          id: cyclist.id as string,
          fullName: cyclist.full_name as string,
          phoneNumber: cyclist.phone_number as string,
          isActive: Boolean(cyclist.is_active),
          coverageNeighborhoodIds,
        },
        availableRuns: ((availableRows ?? []) as OrderRow[]).map(mapOrder),
        activeDeliveries: ((activeRows ?? []) as OrderRow[]).map(mapOrder),
        totalCashCollectedMad,
      };
    } catch (error) {
      console.error("getCyclistDashboardData failed:", error);
      throw new Error("Failed to load cyclist dashboard.");
    }
  });

export const setCyclistActiveState = createServerFn({ method: "POST" })
  .inputValidator((input) => setCyclistActiveStateInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { error } = await (supabaseAdmin as any)
        .from("cyclists")
        .update({ is_active: data.isActive })
        .eq("id", data.cyclistId);

      if (error) {
        throw new Error(error.message);
      }

      return { ok: true, isActive: data.isActive };
    } catch (error) {
      console.error("setCyclistActiveState failed:", error);
      throw new Error("Failed to update cyclist status.");
    }
  });

export const acceptDeliveryRun = createServerFn({ method: "POST" })
  .inputValidator((input) => acceptDeliveryInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: cyclist, error: cyclistError } = await (supabaseAdmin as any)
        .from("cyclists")
        .select("id")
        .eq("id", data.cyclistId)
        .single();

      if (cyclistError || !cyclist?.id) {
        throw new Error(cyclistError?.message ?? "Cyclist not found.");
      }

      const { data: coverageRows, error: coverageError } = await (supabaseAdmin as any)
        .from("cyclist_coverage")
        .select("neighborhood_id")
        .eq("cyclist_id", cyclist.id);

      if (coverageError) {
        throw new Error(coverageError.message);
      }

      const coverageNeighborhoodIds = Array.from(
        new Set(((coverageRows ?? []) as Array<{ neighborhood_id: string }>).map((row) => row.neighborhood_id)),
      );

      if (coverageNeighborhoodIds.length === 0) {
        throw new Error("No coverage areas assigned to this cyclist.");
      }

      const { data: updated, error } = await (supabaseAdmin as any)
        .from("orders")
        .update({ cyclist_id: cyclist.id, status: "delivering" })
        .eq("id", data.orderId)
        .eq("status", "ready")
        .in("neighborhood_id", coverageNeighborhoodIds)
        .is("cyclist_id", null)
        .select("id")
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!updated?.id) {
        throw new Error("Delivery was already accepted by another cyclist.");
      }

      return { ok: true };
    } catch (error) {
      console.error("acceptDeliveryRun failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to accept delivery.");
    }
  });

export const getCyclistWalletSummary = createServerFn({ method: "POST" })
  .inputValidator((input) => cyclistWalletInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: cyclist, error: cyclistError } = await (supabaseAdmin as any)
        .from("cyclists")
        .select("id, full_name")
        .eq("id", data.cyclistId)
        .single();

      if (cyclistError || !cyclist?.id) {
        throw new Error(cyclistError?.message ?? "Cyclist not found.");
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const { data: deliveredTodayRows, error: deliveredTodayError } = await (supabaseAdmin as any)
        .from("orders")
        .select("delivery_fee")
        .eq("cyclist_id", data.cyclistId)
        .eq("status", "delivered")
        .gte("delivered_at", startOfDay.toISOString())
        .lt("delivered_at", endOfDay.toISOString());

      if (deliveredTodayError) {
        throw new Error(deliveredTodayError.message);
      }

      const { data: pendingSettlementRows, error: pendingSettlementError } = await (supabaseAdmin as any)
        .from("orders")
        .select("delivery_fee, total_price")
        .eq("cyclist_id", data.cyclistId)
        .eq("status", "delivered")
        .eq("vendor_settlement_status", "pending");

      if (pendingSettlementError) {
        throw new Error(pendingSettlementError.message);
      }

      const todayRows = (deliveredTodayRows ?? []) as Array<{
        delivery_fee: number;
      }>;

      const pendingRows = (pendingSettlementRows ?? []) as Array<{
        total_price: number;
        delivery_fee: number;
      }>;

      const myEarningsMad = todayRows.reduce((sum, row) => sum + Number(row.delivery_fee ?? 0), 0);
      const cashToRemitMad = pendingRows.reduce(
        (sum, row) => sum + Math.max(Number(row.total_price ?? 0) - Number(row.delivery_fee ?? 0), 0),
        0,
      );

      return {
        cyclist: {
          id: cyclist.id as string,
          fullName: cyclist.full_name as string,
        },
        myEarningsMad,
        cashToRemitMad,
        deliveredTodayCount: todayRows.length,
        pendingSettlementOrdersCount: pendingRows.length,
      } satisfies CyclistWalletSummary;
    } catch (error) {
      console.error("getCyclistWalletSummary failed:", error);
      throw new Error("Failed to load cyclist wallet summary.");
    }
  });

export const getCyclistEarningsHistory = createServerFn({ method: "POST" })
  .inputValidator((input) => cyclistEarningsHistoryInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: cyclist, error: cyclistError } = await (supabaseAdmin as any)
        .from("cyclists")
        .select("id")
        .eq("id", data.cyclistId)
        .single();

      if (cyclistError || !cyclist?.id) {
        throw new Error(cyclistError?.message ?? "Cyclist not found.");
      }

      const now = new Date();
      const start = new Date(now);

      if (data.period === "today") {
        start.setHours(0, 0, 0, 0);
      } else if (data.period === "week") {
        start.setHours(0, 0, 0, 0);
        const currentDay = start.getDay();
        const diffToMonday = (currentDay + 6) % 7;
        start.setDate(start.getDate() - diffToMonday);
      } else {
        start.setHours(0, 0, 0, 0);
        start.setDate(1);
      }

      const { data: rows, error } = await (supabaseAdmin as any)
        .from("orders")
        .select("id, delivered_at, delivery_fee")
        .eq("cyclist_id", data.cyclistId)
        .eq("status", "delivered")
        .gte("delivered_at", start.toISOString())
        .order("delivered_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      const deliveries = ((rows ?? []) as Array<{ id: string; delivered_at: string | null; delivery_fee: number }>).map(
        (row) => ({
          orderId: row.id,
          deliveredAt: row.delivered_at ?? new Date(0).toISOString(),
          deliveryFeeMad: Number(row.delivery_fee ?? 0),
        }),
      );

      const totalEarningsMad = deliveries.reduce((sum, row) => sum + row.deliveryFeeMad, 0);

      return {
        period: data.period,
        totalEarningsMad,
        deliveries,
      } satisfies CyclistEarningsHistoryResponse;
    } catch (error) {
      console.error("getCyclistEarningsHistory failed:", error);
      throw new Error("Failed to load cyclist earnings history.");
    }
  });

export const markDeliveryAsDelivered = createServerFn({ method: "POST" })
  .inputValidator((input) => markDeliveredInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: rpcResult, error } = await (supabaseAdmin as any).rpc("complete_delivery_and_apply_payment", {
        p_cyclist_id: data.cyclistId,
        p_order_id: data.orderId,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!Array.isArray(rpcResult) || !rpcResult[0]?.order_id) {
        throw new Error("Delivery not found or already completed.");
      }

      return { ok: true };
    } catch (error) {
      console.error("markDeliveryAsDelivered failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to complete delivery.");
    }
  });

export const verifyDeliveryCodeAndComplete = createServerFn({ method: "POST" })
  .inputValidator((input) => verifyDeliveryInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: order, error: orderError } = await (supabaseAdmin as any)
        .from("orders")
        .select("id, cyclist_id, status, delivery_auth_code")
        .eq("id", data.orderId)
        .eq("cyclist_id", data.cyclistId)
        .eq("status", "delivering")
        .maybeSingle();

      if (orderError) {
        throw new Error(orderError.message);
      }

      if (!order?.id) {
        throw new Error("Only the assigned cyclist can validate this delivery.");
      }

      if ((order.delivery_auth_code as string) !== data.deliveryAuthCode) {
        throw new Error("Invalid delivery code.");
      }

      const { data: rpcResult, error } = await (supabaseAdmin as any).rpc("complete_delivery_and_apply_payment", {
        p_cyclist_id: data.cyclistId,
        p_order_id: data.orderId,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!Array.isArray(rpcResult) || !rpcResult[0]?.order_id) {
        throw new Error("Delivery not found or already completed.");
      }

      return { ok: true };
    } catch (error) {
      console.error("verifyDeliveryCodeAndComplete failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to verify delivery code.");
    }
  });
