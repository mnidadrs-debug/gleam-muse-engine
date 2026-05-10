import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AdminOrderStatus = "new" | "preparing" | "ready" | "delivering" | "delivered" | "cancelled";

type AdminOrderRow = {
  id: string;
  vendor_id: string;
  customer_phone: string;
  total_price: number;
  status: AdminOrderStatus;
  created_at: string;
};

type AdminVendorRow = {
  id: string;
  store_name: string;
};

type InvoiceSettingsRow = {
  id: string;
  store_name: string;
  address: string;
  phone: string;
  tax_id: string | null;
  footer_message: string;
  created_at: string;
  updated_at: string;
};

type AdminCustomerProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
};

type AdminCustomerOrderAggregateRow = {
  customer_phone: string | null;
  total_price: number | null;
  delivery_fee: number | null;
};

type GlobalSettingsRow = {
  id: string;
  global_delivery_fee: number;
  minimum_order_amount: number;
  free_delivery_threshold: number;
  marketplace_active: boolean;
  created_at: string;
  updated_at: string;
};

const GLOBAL_SETTINGS_SINGLETON_ID = "00000000-0000-0000-0000-000000000001";

function normalizeInvoiceSettingsRow(row: any): InvoiceSettingsRow {
  return {
    id: row.id,
    store_name: row.store_name ?? "",
    address: row.address ?? "",
    phone: row.phone ?? "",
    tax_id: row.tax_id ?? null,
    footer_message: row.footer_message ?? "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeGlobalSettingsRow(row: any): GlobalSettingsRow {
  return {
    id: row.id,
    global_delivery_fee: Number(row.global_delivery_fee ?? 10),
    minimum_order_amount: Number(row.minimum_order_amount ?? 50),
    free_delivery_threshold: Number(row.free_delivery_threshold ?? 500),
    marketplace_active: Boolean(row.marketplace_active ?? true),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const getAdminOverviewAnalytics = createServerFn({ method: "GET" }).handler(async () => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).toISOString();

  const [ordersTodayRes, activeVendorsRes, revenueRes, weeklyOrdersRes] = await Promise.all([
    (supabaseAdmin as any)
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart)
      .lt("created_at", tomorrowStart),
    (supabaseAdmin as any)
      .from("vendors")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    (supabaseAdmin as any)
      .from("orders")
      .select("total_price")
      .eq("status", "delivered"),
    (supabaseAdmin as any)
      .from("orders")
      .select("created_at")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: true }),
  ]);

  if (ordersTodayRes.error) throw new Error(ordersTodayRes.error.message);
  if (activeVendorsRes.error) throw new Error(activeVendorsRes.error.message);
  if (revenueRes.error) throw new Error(revenueRes.error.message);
  if (weeklyOrdersRes.error) throw new Error(weeklyOrdersRes.error.message);

  const weeklyCounts = new Map<string, number>();
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    const dayKey = day.toISOString().slice(0, 10);
    weeklyCounts.set(dayKey, 0);
  }

  for (const row of (weeklyOrdersRes.data ?? []) as Array<{ created_at: string }>) {
    const dayKey = row.created_at.slice(0, 10);
    if (weeklyCounts.has(dayKey)) {
      weeklyCounts.set(dayKey, (weeklyCounts.get(dayKey) ?? 0) + 1);
    }
  }

  const weeklyTrends = Array.from(weeklyCounts.entries()).map(([day, count]) => ({
    day,
    label: new Date(day).toLocaleDateString("en-US", { weekday: "short" }),
    orders: count,
  }));

  const totalRevenueMad = ((revenueRes.data ?? []) as Array<{ total_price: number | null }>).reduce(
    (sum, row) => sum + Number(row.total_price ?? 0),
    0,
  );

  return {
    totalOrdersToday: ordersTodayRes.count ?? 0,
    activeVendors: activeVendorsRes.count ?? 0,
    totalRevenueMad,
    weeklyTrends,
  };
});

export const listAdminOrders = createServerFn({ method: "GET" }).handler(async () => {
  const [ordersRes, vendorsRes] = await Promise.all([
    (supabaseAdmin as any)
      .from("orders")
      .select("id, vendor_id, customer_phone, total_price, status, created_at")
      .order("created_at", { ascending: false }),
    (supabaseAdmin as any).from("vendors").select("id, store_name"),
  ]);

  if (ordersRes.error) throw new Error(ordersRes.error.message);
  if (vendorsRes.error) throw new Error(vendorsRes.error.message);

  const vendorMap = new Map(
    ((vendorsRes.data ?? []) as AdminVendorRow[]).map((vendor) => [vendor.id, vendor.store_name]),
  );

  return ((ordersRes.data ?? []) as AdminOrderRow[]).map((order) => ({
    id: order.id,
    createdAt: order.created_at,
    customerPhone: order.customer_phone,
    totalPrice: Number(order.total_price ?? 0),
    status: order.status,
    vendorName: vendorMap.get(order.vendor_id) ?? "Unknown Vendor",
  }));
});

export const getAdminInvoiceSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await (supabaseAdmin as any)
    .from("invoice_settings")
    .select("id, store_name, address, phone, tax_id, footer_message, created_at, updated_at")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Failed to load receipt settings.");
  }

  if (data?.id) {
    return normalizeInvoiceSettingsRow(data);
  }

  const { data: inserted, error: insertError } = await (supabaseAdmin as any)
    .from("invoice_settings")
    .insert({
      store_name: "",
      address: "",
      phone: "",
      tax_id: null,
      footer_message: "",
    })
    .select("id, store_name, address, phone, tax_id, footer_message, created_at, updated_at")
    .single();

  if (insertError || !inserted?.id) {
    throw new Error(insertError?.message ?? "Failed to initialize receipt settings.");
  }

  return normalizeInvoiceSettingsRow(inserted);
});

export const updateAdminInvoiceSettings = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        storeName: z.string().trim().min(1).max(120),
        address: z.string().trim().min(1).max(220),
        phone: z.string().trim().min(3).max(30),
        taxId: z.string().trim().max(120).nullable(),
        footerMessage: z.string().trim().min(1).max(240),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: updated, error } = await (supabaseAdmin as any)
      .from("invoice_settings")
      .update({
        store_name: data.storeName,
        address: data.address,
        phone: data.phone,
        tax_id: data.taxId,
        footer_message: data.footerMessage,
      })
      .eq("id", data.id)
      .select("id, store_name, address, phone, tax_id, footer_message, created_at, updated_at")
      .single();

    if (error || !updated?.id) {
      throw new Error(error?.message ?? "Failed to save receipt settings.");
    }

    return updated as InvoiceSettingsRow;
  });

export const getGlobalSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { data: singletonRow, error: singletonError } = await (supabaseAdmin as any)
    .from("global_settings")
    .select("id, global_delivery_fee, minimum_order_amount, free_delivery_threshold, marketplace_active, created_at, updated_at")
    .eq("id", GLOBAL_SETTINGS_SINGLETON_ID)
    .maybeSingle();

  if (singletonError) {
    throw new Error(singletonError.message ?? "Failed to load global settings.");
  }

  if (singletonRow?.id) {
    return normalizeGlobalSettingsRow(singletonRow);
  }

  const { data: fallbackRow, error: fallbackError } = await (supabaseAdmin as any)
    .from("global_settings")
    .select("global_delivery_fee, minimum_order_amount, free_delivery_threshold, marketplace_active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    throw new Error(fallbackError.message ?? "Failed to load global settings.");
  }

  const { data: upserted, error: upsertError } = await (supabaseAdmin as any)
    .from("global_settings")
    .upsert(
      {
        id: GLOBAL_SETTINGS_SINGLETON_ID,
        global_delivery_fee: Number(fallbackRow?.global_delivery_fee ?? 10),
        minimum_order_amount: Number(fallbackRow?.minimum_order_amount ?? 50),
        free_delivery_threshold: Number(fallbackRow?.free_delivery_threshold ?? 500),
        marketplace_active: Boolean(fallbackRow?.marketplace_active ?? true),
      },
      { onConflict: "id" },
    )
    .select("id, global_delivery_fee, minimum_order_amount, free_delivery_threshold, marketplace_active, created_at, updated_at")
    .single();

  if (upsertError || !upserted?.id) {
    throw new Error(upsertError?.message ?? "Failed to initialize global settings.");
  }

  return normalizeGlobalSettingsRow(upserted);
});

export const updateGlobalSettings = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        globalDeliveryFee: z.coerce.number().min(0).max(100000),
        minimumOrderAmount: z.coerce.number().min(0).max(100000),
        freeDeliveryThreshold: z.coerce.number().min(0).max(1000000),
        marketplaceActive: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: updated, error } = await (supabaseAdmin as any)
      .from("global_settings")
      .upsert(
        {
          id: GLOBAL_SETTINGS_SINGLETON_ID,
          global_delivery_fee: data.globalDeliveryFee,
          minimum_order_amount: data.minimumOrderAmount,
          free_delivery_threshold: data.freeDeliveryThreshold,
          marketplace_active: data.marketplaceActive,
        },
        { onConflict: "id" },
      )
      .select("id, global_delivery_fee, minimum_order_amount, free_delivery_threshold, marketplace_active, created_at, updated_at")
      .single();

    if (error || !updated?.id) {
      throw new Error(error?.message ?? "Failed to save global settings.");
    }

    return normalizeGlobalSettingsRow(updated);
  });

export const listAdminCustomers = createServerFn({ method: "GET" }).handler(async () => {
  const [profilesRes, ordersRes] = await Promise.all([
    (supabaseAdmin as any)
      .from("profiles")
      .select("id, full_name, phone, address, created_at")
      .order("created_at", { ascending: false }),
    (supabaseAdmin as any)
      .from("orders")
      .select("customer_phone, total_price, delivery_fee")
      .eq("status", "delivered"),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (ordersRes.error) throw new Error(ordersRes.error.message);

  const orderMetricsByPhone = new Map<string, { totalOrders: number; ltvMad: number }>();

  for (const row of (ordersRes.data ?? []) as AdminCustomerOrderAggregateRow[]) {
    const phone = row.customer_phone?.trim();
    if (!phone) continue;

    const current = orderMetricsByPhone.get(phone) ?? { totalOrders: 0, ltvMad: 0 };
    orderMetricsByPhone.set(phone, {
      totalOrders: current.totalOrders + 1,
      ltvMad: current.ltvMad + Number(row.total_price ?? 0) + Number(row.delivery_fee ?? 0),
    });
  }

  return ((profilesRes.data ?? []) as AdminCustomerProfileRow[]).map((profile) => {
    const phone = profile.phone?.trim() ?? "";
    const metrics = phone ? orderMetricsByPhone.get(phone) : undefined;

    return {
      id: profile.id,
      fullName: profile.full_name?.trim() || "—",
      phone: phone || "—",
      address: profile.address?.trim() || "—",
      joinedAt: profile.created_at,
      totalOrders: metrics?.totalOrders ?? 0,
      ltvMad: metrics?.ltvMad ?? 0,
    };
  });
});
