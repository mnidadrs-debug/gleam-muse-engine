import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const orderItemSchema = z.object({
  productId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  quantity: z.number().int().min(1).max(99),
  unitPriceMad: z.number().min(0).max(100000),
});

const createCustomerOrderInputSchema = z.object({
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().regex(/^\+212[0-9]{9}$/),
  neighborhoodId: z.string().uuid(),
  deliveryNotes: z.string().max(600),
  paymentMethod: z.enum(["COD", "Carnet"]).default("COD"),
  deliveryFee: z.number().min(0).default(0),
  totalPrice: z.number().min(0),
  itemCount: z.number().int().min(1),
  items: z.array(orderItemSchema).min(1),
});

const updateOrderStatusInputSchema = z.object({
  phoneNumber: z.string().trim().regex(/^\+212[0-9]{9}$/),
  orderId: z.string().uuid(),
  nextStatus: z.enum(["preparing", "ready"]),
});

const upsertCustomerProfileInputSchema = z.object({
  phoneNumber: z.string().trim().regex(/^\+212[0-9]{9}$/),
  fullName: z.string().trim().min(1).max(120),
  address: z.string().trim().max(220),
  savedInstructions: z.string().trim().max(600).optional(),
  neighborhoodId: z.string().uuid().nullable(),
});

const getCustomerOrdersInputSchema = z.object({
  phoneNumber: z.string().trim().regex(/^\+212[0-9]{9}$/),
});

const vendorSettlementSummaryInputSchema = z.object({
  vendorId: z.string().uuid(),
});

const settleCyclistCashHandoverInputSchema = z.object({
  phoneNumber: z.string().trim().regex(/^\+212[0-9]{9}$/),
  cyclistId: z.string().uuid(),
  expectedAmount: z.number(),
});

type VendorRow = {
  id: string;
  store_name: string;
  phone_number?: string;
};

type OrderRow = {
  id: string;
  vendor_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_notes: string;
  payment_method: "COD" | "Carnet";
  status: "new" | "preparing" | "ready" | "delivering" | "delivered";
  delivery_auth_code: string;
  delivery_fee: number;
  total_price: number;
  item_count: number;
  order_items: Array<{ name: string; quantity: number; unitPriceMad: number; imageUrl?: string | null }>;
  vendor_settlement_status?: "pending" | "settled";
  created_at: string;
};

export type CustomerOrderRow = OrderRow;

export type VendorSettlementSummary = {
  unsettledCashWithCyclistsMad: number;
  totalReceivedTodayMad: number;
  lifetimeEarningsMad: number;
  pendingCyclistCount: number;
};

async function resolveVendorByPhone(phoneNumber: string) {
  const { data: vendor, error } = await (supabaseAdmin as any)
    .from("vendors")
    .select("id, store_name, phone_number")
    .eq("phone_number", phoneNumber)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error || !vendor?.id) {
    throw new Error("Vendor session is invalid.");
  }

  return vendor as VendorRow;
}

async function resolveVendorsForNeighborhood(neighborhoodId: string) {
  const { data: zoneRows, error: zonesError } = await (supabaseAdmin as any)
    .from("vendor_service_zones")
    .select("vendor_id")
    .eq("neighborhood_id", neighborhoodId);

  if (zonesError) {
    throw new Error(zonesError.message);
  }

  let vendorIds = ((zoneRows ?? []) as Array<{ vendor_id: string | null }>)
    .map((row) => row.vendor_id)
    .filter((value): value is string => Boolean(value));

  if (vendorIds.length === 0) {
    const { data: neighborhood, error: neighborhoodError } = await (supabaseAdmin as any)
      .from("neighborhoods")
      .select("vendor_id")
      .eq("id", neighborhoodId)
      .maybeSingle();

    if (neighborhoodError) {
      throw new Error(neighborhoodError.message);
    }

    const fallbackVendorId = (neighborhood as { vendor_id?: string | null } | null)?.vendor_id ?? null;
    vendorIds = fallbackVendorId ? [fallbackVendorId] : [];
  }

  if (vendorIds.length === 0) {
    return [] as Array<{ id: string }>;
  }

  const { data: vendors, error: vendorsError } = await (supabaseAdmin as any)
    .from("vendors")
    .select("id")
    .in("id", vendorIds)
    .eq("is_active", true);

  if (vendorsError) {
    throw new Error(vendorsError.message);
  }

  return (vendors ?? []) as Array<{ id: string }>;
}

export const createCustomerOrder = createServerFn({ method: "POST" })
  .inputValidator((input) => createCustomerOrderInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: existingProfile, error: profileLookupError } = await (supabaseAdmin as any)
        .from("profiles")
        .select("id")
        .eq("phone", data.customerPhone)
        .maybeSingle();

      if (profileLookupError) {
        throw new Error(profileLookupError.message);
      }

      let customerUserId = (existingProfile as { id?: string } | null)?.id ?? null;

      if (!customerUserId) {
        const phoneSlug = data.customerPhone.replace(/\D/g, "");
        const syntheticEmail = `customer-${phoneSlug}@checkout.local`;
        const syntheticPassword = `${crypto.randomUUID()}A!1`;

        const { data: createdUserData, error: createUserError } = await (supabaseAdmin as any).auth.admin.createUser({
          email: syntheticEmail,
          password: syntheticPassword,
          email_confirm: true,
          user_metadata: {
            name: data.customerName,
            phone: data.customerPhone,
          },
        });

        if (createUserError) {
          const { data: listedUsers, error: listUsersError } = await (supabaseAdmin as any).auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          });

          if (listUsersError) {
            throw new Error(createUserError.message);
          }

          const existingUser = (listedUsers?.users ?? []).find(
            (user: { email?: string | null; id: string }) =>
              typeof user.email === "string" && user.email.toLowerCase() === syntheticEmail.toLowerCase(),
          );

          if (!existingUser?.id) {
            throw new Error(createUserError.message);
          }

          customerUserId = existingUser.id;
        } else {
          customerUserId = createdUserData?.user?.id ?? null;
        }

        if (!customerUserId) {
          throw new Error("Customer profile not found.");
        }

        const { error: profileUpsertError } = await (supabaseAdmin as any).from("profiles").upsert(
          {
            id: customerUserId,
            phone: data.customerPhone,
            full_name: data.customerName,
            display_name: data.customerName,
          },
          {
            onConflict: "id",
            ignoreDuplicates: false,
          },
        );

        if (profileUpsertError) {
          throw new Error(profileUpsertError.message);
        }
      }

      if (!customerUserId) {
        throw new Error("Customer profile not found.");
      }

      const { data: neighborhood, error: neighborhoodError } = await (supabaseAdmin as any)
        .from("neighborhoods")
        .select("vendor_id")
        .eq("id", data.neighborhoodId)
        .maybeSingle();

      if (neighborhoodError) {
        throw new Error(neighborhoodError.message);
      }

      const vendorId = (neighborhood as { vendor_id?: string | null } | null)?.vendor_id ?? null;
      if (!vendorId) {
        throw new Error("No active vendor available in selected neighborhood.");
      }

      const { data: vendor, error: vendorError } = await (supabaseAdmin as any)
        .from("vendors")
        .select("id")
        .eq("id", vendorId)
        .eq("is_active", true)
        .maybeSingle();

      if (vendorError || !vendor?.id) {
        throw new Error("No active vendor available in selected neighborhood.");
      }

      const { data: inserted, error } = await (supabaseAdmin as any)
        .from("orders")
        .insert({
          customer_user_id: customerUserId,
          vendor_id: vendor.id,
          customer_name: data.customerName,
          customer_phone: data.customerPhone,
          neighborhood_id: data.neighborhoodId,
          delivery_notes: data.deliveryNotes,
          payment_method: data.paymentMethod,
          status: "new",
          delivery_fee: data.deliveryFee,
          total_price: data.totalPrice,
          item_count: data.itemCount,
          order_items: data.items,
        })
        .select("id")
        .single();

      if (error || !inserted?.id) {
        throw new Error(error?.message ?? "Order insert failed.");
      }

      return { id: inserted.id as string };
    } catch (error) {
      console.error("createCustomerOrder failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Order confirmation failed: ${message}`);
    }
  });

export const getVendorDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { data: vendor, error: vendorError } = await (supabaseAdmin as any)
      .from("vendors")
      .select("id, store_name")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (vendorError || !vendor?.id) {
      return {
        vendor: null,
        orders: [] as Array<OrderRow>,
      };
    }

    const { data: orders, error: ordersError } = await (supabaseAdmin as any)
      .from("orders")
      .select(
        "id, vendor_id, customer_name, customer_phone, delivery_notes, payment_method, status, delivery_auth_code, delivery_fee, total_price, item_count, order_items, vendor_settlement_status, created_at",
      )
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false });

    if (ordersError) {
      throw new Error(ordersError.message);
    }

    const orderItemNames = Array.from(
      new Set(
        (orders ?? []).flatMap((order: any) =>
          Array.isArray(order?.order_items)
            ? order.order_items
                .map((item: any) => (typeof item?.name === "string" ? item.name.trim() : null))
                .filter(Boolean)
            : [],
        ),
      ),
    ) as string[];

    let productImageMap = new Map<string, string | null>();
    if (orderItemNames.length > 0) {
      const { data: products, error: productsError } = await (supabaseAdmin as any)
        .from("master_products")
        .select("product_name, image_url")
        .in("product_name", orderItemNames);

      if (productsError) {
        throw new Error(productsError.message);
      }

      productImageMap = new Map(
        (products ?? [])
          .filter((product: any) => typeof product?.product_name === "string")
          .map((product: any) => [product.product_name.trim().toLowerCase(), product.image_url ?? null]),
      );
    }

    const hydratedOrders = (orders ?? []).map((order: any) => {
      const items = Array.isArray(order?.order_items)
        ? order.order_items.map((item: any) => ({
            ...item,
            imageUrl:
              typeof item?.name === "string"
                ? productImageMap.get(item.name.trim().toLowerCase()) ?? null
                : null,
          }))
        : [];

      return {
        ...order,
        order_items: items,
      };
    });

    return {
      vendor: {
        id: (vendor as VendorRow).id,
        storeName: (vendor as VendorRow).store_name,
      },
      orders: hydratedOrders as Array<OrderRow>,
    };
  } catch (error) {
    console.error("getVendorDashboardData failed:", error);
    throw new Error("Failed to load vendor queue.");
  }
});

export const updateVendorOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => updateOrderStatusInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: order, error: orderError } = await (supabaseAdmin as any)
        .from("orders")
        .select("id, status")
        .eq("id", data.orderId)
        .single();

      if (orderError || !order?.id) {
        throw new Error("Order not found.");
      }

      const currentStatus = (order as { status: string }).status;
      const allowed =
        (currentStatus === "new" && data.nextStatus === "preparing") ||
        (currentStatus === "preparing" && data.nextStatus === "ready");

      if (!allowed) {
        throw new Error("Invalid status transition.");
      }

      const { error: updateError } = await (supabaseAdmin as any)
        .from("orders")
        .update({ status: data.nextStatus })
        .eq("id", data.orderId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      return { ok: true };
    } catch (error) {
      console.error("updateVendorOrderStatus failed:", error);
      throw new Error("Order status update failed.");
    }
  });

export const getVendorSettlementSummary = createServerFn({ method: "POST" })
  .inputValidator((input) => vendorSettlementSummaryInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const [
        { data: pendingRows, error: pendingError },
        { data: receivedRows, error: receivedError },
        { data: lifetimeRows, error: lifetimeError },
      ] = await Promise.all([
        (supabaseAdmin as any)
          .from("orders")
          .select("cyclist_id, total_price, delivery_fee")
          .eq("vendor_id", data.vendorId)
          .eq("status", "delivered")
          .eq("payment_method", "COD")
          .eq("vendor_settlement_status", "pending")
          .not("cyclist_id", "is", null),
        (supabaseAdmin as any)
          .from("orders")
          .select("total_price, delivery_fee")
          .eq("vendor_id", data.vendorId)
          .eq("status", "delivered")
          .eq("payment_method", "COD")
          .eq("vendor_settlement_status", "settled")
          .gte("updated_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
          .lt("updated_at", new Date(new Date().setHours(24, 0, 0, 0)).toISOString()),
        (supabaseAdmin as any)
          .from("orders")
          .select("total_price, delivery_fee")
          .eq("vendor_id", data.vendorId)
          .eq("status", "delivered")
          .eq("payment_method", "COD")
          .eq("vendor_settlement_status", "settled"),
      ]);

      if (pendingError) {
        throw new Error(pendingError.message);
      }

      if (receivedError) {
        throw new Error(receivedError.message);
      }

      if (lifetimeError) {
        throw new Error(lifetimeError.message);
      }

      const pending = (pendingRows ?? []) as Array<{ cyclist_id: string | null; total_price: number; delivery_fee: number }>;
      const received = (receivedRows ?? []) as Array<{ total_price: number; delivery_fee: number }>;
      const lifetime = (lifetimeRows ?? []) as Array<{ total_price: number; delivery_fee: number }>;

      const unsettledCashWithCyclistsMad = pending.reduce(
        (sum, row) => sum + Math.max(Number(row.total_price ?? 0) - Number(row.delivery_fee ?? 0), 0),
        0,
      );

      const totalReceivedTodayMad = received.reduce(
        (sum, row) => sum + Math.max(Number(row.total_price ?? 0) - Number(row.delivery_fee ?? 0), 0),
        0,
      );

      const lifetimeEarningsMad = lifetime.reduce(
        (sum, row) => sum + Math.max(Number(row.total_price ?? 0) - Number(row.delivery_fee ?? 0), 0),
        0,
      );

      const pendingCyclistCount = new Set(pending.map((row) => row.cyclist_id).filter(Boolean)).size;

      return {
        unsettledCashWithCyclistsMad,
        totalReceivedTodayMad,
        lifetimeEarningsMad,
        pendingCyclistCount,
      } satisfies VendorSettlementSummary;
    } catch (error) {
      console.error("getVendorSettlementSummary failed:", error);
      throw new Error("Failed to load vendor settlement summary.");
    }
  });

export const settleCyclistCashHandover = createServerFn({ method: "POST" })
  .inputValidator((input) => settleCyclistCashHandoverInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: pendingRows, error: pendingError } = await (supabaseAdmin as any)
        .from("orders")
        .select("id, total_price, delivery_fee, payment_method")
        .eq("vendor_id", data.vendorId)
        .eq("cyclist_id", data.cyclistId)
        .eq("status", "delivered")
        .eq("vendor_settlement_status", "pending");

      if (pendingError) {
        throw new Error(pendingError.message);
      }

      const rows = (pendingRows ?? []) as Array<{
        id: string;
        total_price: number;
        delivery_fee: number;
        payment_method: "COD" | "Carnet";
      }>;

      const cashToRemitMad = rows
        .filter((row) => row.payment_method === "COD")
        .reduce((sum, row) => sum + Math.max(Number(row.total_price ?? 0) - Number(row.delivery_fee ?? 0), 0), 0);

      const owedByVendorMad = rows
        .filter((row) => row.payment_method === "Carnet")
        .reduce((sum, row) => sum + Number(row.delivery_fee ?? 0), 0);

      const computedAmount = cashToRemitMad - owedByVendorMad;

      if (Math.abs(computedAmount - data.expectedAmount) > 0.5) {
        throw new Error("Settlement amount mismatch. Please refresh and scan again.");
      }

      const { data: updatedRows, error: updateError } = await (supabaseAdmin as any)
        .from("orders")
        .update({ vendor_settlement_status: "settled" })
        .eq("vendor_id", data.vendorId)
        .eq("cyclist_id", data.cyclistId)
        .eq("status", "delivered")
        .eq("vendor_settlement_status", "pending")
        .select("id");

      if (updateError) {
        throw new Error(updateError.message);
      }

      return {
        ok: true,
        settledAmountMad: computedAmount,
        settledOrdersCount: (updatedRows ?? []).length,
      };
    } catch (error) {
      console.error("settleCyclistCashHandover failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to settle cyclist handover.");
    }
  });

export const upsertCustomerProfile = createServerFn({ method: "POST" })
  .inputValidator((input) => upsertCustomerProfileInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: profileRow, error: profileLookupError } = await (supabaseAdmin as any)
        .from("profiles")
        .select("id")
        .eq("phone", data.phoneNumber)
        .maybeSingle();

      if (profileLookupError) {
        throw new Error(profileLookupError.message);
      }

      let profileId = (profileRow as { id?: string } | null)?.id ?? null;

      if (!profileId) {
        const phoneSlug = data.phoneNumber.replace(/\D/g, "");
        const syntheticEmail = `customer-${phoneSlug}@checkout.local`;
        const syntheticPassword = `${crypto.randomUUID()}A!1`;

        const { data: createdUserData, error: createUserError } = await (supabaseAdmin as any).auth.admin.createUser({
          email: syntheticEmail,
          password: syntheticPassword,
          email_confirm: true,
          user_metadata: {
            name: data.fullName,
            phone: data.phoneNumber,
          },
        });

        if (createUserError) {
          const { data: listedUsers, error: listUsersError } = await (supabaseAdmin as any).auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          });

          if (listUsersError) {
            throw new Error(createUserError.message);
          }

          const existingUser = (listedUsers?.users ?? []).find(
            (user: { email?: string | null; id: string }) =>
              typeof user.email === "string" && user.email.toLowerCase() === syntheticEmail.toLowerCase(),
          );

          if (!existingUser?.id) {
            throw new Error(createUserError.message);
          }

          profileId = existingUser.id;
        } else {
          profileId = createdUserData?.user?.id ?? null;
        }

        if (!profileId) {
          throw new Error("Customer profile not found.");
        }
      }

      const { error: profileUpsertError } = await (supabaseAdmin as any).from("profiles").upsert(
        {
          id: profileId,
          phone: data.phoneNumber,
          full_name: data.fullName,
          address: data.address,
          neighborhood_id: data.neighborhoodId,
          display_name: data.fullName,
        },
        {
          onConflict: "id",
          ignoreDuplicates: false,
        },
      );

      if (profileUpsertError) {
        throw new Error(profileUpsertError.message);
      }

      const { error: legacyError } = await (supabaseAdmin as any).from("customers").upsert(
        {
          user_id: profileId,
          phone_number: data.phoneNumber,
          full_name: data.fullName,
          saved_instructions: data.savedInstructions ?? null,
          neighborhood_id: data.neighborhoodId,
        },
        {
          onConflict: "user_id",
          ignoreDuplicates: false,
        },
      );

      if (legacyError) {
        console.error("Legacy customer profile sync failed:", legacyError.message);
      }

      return { ok: true, updatedCount: 1 };
    } catch (error) {
      console.error("upsertCustomerProfile failed:", error);
      throw new Error("Failed to save customer profile.");
    }
  });

export const getCustomerOrders = createServerFn({ method: "POST" })
  .inputValidator((input) => getCustomerOrdersInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: orders, error } = await (supabaseAdmin as any)
        .from("orders")
        .select(
          "id, vendor_id, customer_name, customer_phone, delivery_notes, payment_method, status, delivery_auth_code, delivery_fee, total_price, item_count, order_items, created_at",
        )
        .eq("customer_phone", data.phoneNumber)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (orders ?? []) as Array<CustomerOrderRow>;
    } catch (error) {
      console.error("getCustomerOrders failed:", error);
      throw new Error("Failed to load customer orders.");
    }
  });