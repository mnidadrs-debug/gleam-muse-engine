import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const moroccoPhoneSchema = z.string().trim().regex(/^\+212[0-9]{9}$/);
const customerCinSchema = z.string().trim().regex(/^[A-Za-z0-9-]{4,30}$/);

const upsertCarnetCustomerInputSchema = z.object({
  customerPhone: moroccoPhoneSchema,
  maxLimit: z.number().min(0).max(100000),
  customerName: z.string().trim().min(1).max(120).optional(),
  customerCin: customerCinSchema,
});

const clearCarnetDebtInputSchema = z.object({
  customerPhone: moroccoPhoneSchema,
});

const getCheckoutPaymentOptionsInputSchema = z.object({
  customerPhone: moroccoPhoneSchema,
  neighborhoodId: z.string().uuid(),
  cartTotal: z.number().positive(),
});

const lookupCustomerByPhoneInputSchema = z.object({
  customerPhone: moroccoPhoneSchema,
});

const verifyAndAddVendorCarnetCustomerInputSchema = z.object({
  customerPhone: moroccoPhoneSchema,
  maxLimit: z.number().min(0).max(100000),
  customerName: z.string().trim().min(1).max(120).optional(),
  customerCin: customerCinSchema,
  otpCode: z.string().trim().regex(/^[0-9]{4}$/),
});

const getCarnetCustomerLedgerInputSchema = z.object({
  customerPhone: moroccoPhoneSchema,
});

const recordVendorCarnetPaymentInputSchema = z.object({
  customerPhone: moroccoPhoneSchema,
  amountPaid: z.number().positive().max(100000),
});

const getCustomerCarnetOverviewInputSchema = z.object({
  customerPhone: moroccoPhoneSchema,
});

type VendorCarnetRow = {
  id: string;
  customer_phone: string;
  current_debt: number;
  max_limit: number;
  customer_name: string | null;
  customer_cin: string | null;
  status: string;
};

const getActiveVendor = async () => {
  const { data: vendor, error: vendorError } = await (supabaseAdmin as any)
    .from("vendors")
    .select("id, store_name")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (vendorError || !vendor?.id) {
    return null;
  }

  return {
    id: vendor.id as string,
    storeName: vendor.store_name as string,
  };
};

export const getVendorCarnetData = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const vendor = await getActiveVendor();

    if (!vendor?.id) {
      return {
        vendor: null,
        carnetCustomers: [] as Array<{
          id: string;
          customerPhone: string;
          currentDebt: number;
          maxLimit: number;
          customerName: string | null;
          customerCin: string | null;
          status: string;
        }>,
      };
    }

    const { data: rows, error: carnetError } = await (supabaseAdmin as any)
      .from("vendor_carnet")
      .select("id, customer_phone, current_debt, max_limit, customer_name, customer_cin, status")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false });

    if (carnetError) {
      throw new Error(carnetError.message);
    }

    return {
      vendor,
      carnetCustomers: ((rows ?? []) as VendorCarnetRow[]).map((row) => ({
        id: row.id,
        customerPhone: row.customer_phone,
        currentDebt: Number(row.current_debt ?? 0),
        maxLimit: Number(row.max_limit ?? 0),
        customerName: row.customer_name,
        customerCin: row.customer_cin,
        status: row.status,
      })),
    };
  } catch (error) {
    console.error("getVendorCarnetData failed:", error);
    throw new Error("Failed to load carnet data.");
  }
});

export const upsertVendorCarnetCustomer = createServerFn({ method: "POST" })
  .inputValidator((input) => upsertCarnetCustomerInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const vendor = await getActiveVendor();

      if (!vendor?.id) {
        throw new Error("No active vendor found.");
      }

      const { error } = await (supabaseAdmin as any).from("vendor_carnet").upsert(
        {
          vendor_id: vendor.id,
          customer_phone: data.customerPhone,
          max_limit: data.maxLimit,
          customer_name: data.customerName ?? null,
          customer_cin: data.customerCin,
          status: "active",
        },
        {
          onConflict: "vendor_id,customer_phone",
          ignoreDuplicates: false,
        },
      );

      if (error) {
        throw new Error(error.message);
      }

      return { ok: true };
    } catch (error) {
      console.error("upsertVendorCarnetCustomer failed:", error);
      throw new Error("Failed to save trusted customer.");
    }
  });

export const clearVendorCarnetDebt = createServerFn({ method: "POST" })
  .inputValidator((input) => clearCarnetDebtInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const vendor = await getActiveVendor();

      if (!vendor?.id) {
        throw new Error("No active vendor found.");
      }

      const { error } = await (supabaseAdmin as any).rpc("clear_vendor_carnet_debt", {
        p_vendor_id: vendor.id,
        p_customer_phone: data.customerPhone,
      });

      if (error) {
        throw new Error(error.message);
      }

      return { ok: true };
    } catch (error) {
      console.error("clearVendorCarnetDebt failed:", error);
      throw new Error("Failed to clear customer debt.");
    }
  });

export const getCheckoutPaymentOptions = createServerFn({ method: "POST" })
  .inputValidator((input) => getCheckoutPaymentOptionsInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: neighborhood, error: neighborhoodError } = await (supabaseAdmin as any)
        .from("neighborhoods")
        .select("vendor_id")
        .eq("id", data.neighborhoodId)
        .maybeSingle();

      if (neighborhoodError) {
        throw new Error(neighborhoodError.message);
      }

      const vendorId = (neighborhood as { vendor_id?: string | null } | null)?.vendor_id ?? null;
      const { data: vendor, error: vendorError } = await (supabaseAdmin as any)
        .from("vendors")
        .select("id")
        .eq("is_active", true)
        .eq("id", vendorId)
        .maybeSingle();

      if (vendorError || !vendor?.id) {
        return {
          canUseCarnet: false,
          reason: "No active vendor found for this neighborhood.",
        };
      }

      const { data: carnetRow, error: carnetError } = await (supabaseAdmin as any)
        .from("vendor_carnet")
        .select("current_debt, max_limit")
        .eq("vendor_id", vendor.id)
        .eq("customer_phone", data.customerPhone)
        .maybeSingle();

      if (carnetError) {
        throw new Error(carnetError.message);
      }

      if (!carnetRow) {
        return { canUseCarnet: false, reason: "Customer is not on trusted carnet list." };
      }

      const currentDebt = Number(carnetRow.current_debt ?? 0);
      const maxLimit = Number(carnetRow.max_limit ?? 0);
      const projectedDebt = currentDebt + Number(data.cartTotal ?? 0);

      if (projectedDebt > maxLimit) {
        return {
          canUseCarnet: false,
          reason: "This order would exceed your carnet limit.",
          currentDebt,
          maxLimit,
        };
      }

      return {
        canUseCarnet: true,
        currentDebt,
        maxLimit,
      };
    } catch (error) {
      console.error("getCheckoutPaymentOptions failed:", error);
      throw new Error("Failed to check payment options.");
    }
  });

export const lookupCustomerByPhone = createServerFn({ method: "POST" })
  .inputValidator((input) => lookupCustomerByPhoneInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: customer, error } = await (supabaseAdmin as any)
        .from("customers")
        .select("id, full_name")
        .eq("phone_number", data.customerPhone)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!customer) {
        return { found: false as const };
      }

      return {
        found: true as const,
        customer: {
          id: customer.id as string,
          fullName: (customer.full_name as string | null) ?? null,
        },
      };
    } catch (error) {
      console.error("lookupCustomerByPhone failed:", error);
      throw new Error("Failed to lookup customer.");
    }
  });

export const verifyAndAddVendorCarnetCustomer = createServerFn({ method: "POST" })
  .inputValidator((input) => verifyAndAddVendorCarnetCustomerInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const vendor = await getActiveVendor();

      if (!vendor?.id) {
        throw new Error("No active vendor found.");
      }

      const { data: existingCarnet, error: existingError } = await (supabaseAdmin as any)
        .from("vendor_carnet")
        .select("id")
        .eq("vendor_id", vendor.id)
        .eq("customer_phone", data.customerPhone)
        .maybeSingle();

      if (existingError) {
        throw new Error(existingError.message);
      }

      if (existingCarnet) {
        throw new Error("This customer is already in your carnet list.");
      }

      const { data: otpRequest, error: otpFetchError } = await (supabaseAdmin as any)
        .from("otp_requests")
        .select("id, otp_code")
        .eq("phone_number", data.customerPhone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (otpFetchError) {
        throw new Error(otpFetchError.message);
      }

      if (!otpRequest || otpRequest.otp_code !== data.otpCode) {
        return { verified: false as const };
      }

      const { error: deleteError } = await (supabaseAdmin as any)
        .from("otp_requests")
        .delete()
        .eq("id", otpRequest.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      const { data: customerProfile } = await (supabaseAdmin as any)
        .from("customers")
        .select("full_name")
        .eq("phone_number", data.customerPhone)
        .maybeSingle();

      const resolvedName =
        (customerProfile?.full_name as string | null | undefined) ?? data.customerName ?? null;

      if (!resolvedName) {
        throw new Error("Customer name is required.");
      }

      const { error: insertError } = await (supabaseAdmin as any).from("vendor_carnet").insert({
        vendor_id: vendor.id,
        customer_phone: data.customerPhone,
        max_limit: data.maxLimit,
        customer_name: resolvedName,
        customer_cin: data.customerCin,
        status: "active",
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      return { verified: true as const, ok: true as const };
    } catch (error) {
      console.error("verifyAndAddVendorCarnetCustomer failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to verify and add customer.");
    }
  });

export const getCarnetCustomerLedger = createServerFn({ method: "POST" })
  .inputValidator((input) => getCarnetCustomerLedgerInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const vendor = await getActiveVendor();

      if (!vendor?.id) {
        throw new Error("No active vendor found.");
      }

      const { data: customer, error: customerError } = await (supabaseAdmin as any)
        .from("vendor_carnet")
        .select("id, customer_phone, customer_name, customer_cin, current_debt, max_limit")
        .eq("vendor_id", vendor.id)
        .eq("customer_phone", data.customerPhone)
        .maybeSingle();

      if (customerError) {
        throw new Error(customerError.message);
      }

      if (!customer?.id) {
        throw new Error("Carnet customer not found.");
      }

      const [{ data: carnetOrders, error: ordersError }, { data: payments, error: paymentsError }] =
        await Promise.all([
          (supabaseAdmin as any)
            .from("orders")
            .select("id, total_price, created_at")
            .eq("vendor_id", vendor.id)
            .eq("customer_phone", data.customerPhone)
            .eq("status", "delivered")
            .eq("payment_method", "Carnet")
            .order("created_at", { ascending: false }),
          (supabaseAdmin as any)
            .from("carnet_payments")
            .select("id, amount_paid, created_at")
            .eq("vendor_id", vendor.id)
            .eq("customer_phone", data.customerPhone)
            .order("created_at", { ascending: false }),
        ]);

      if (ordersError) {
        throw new Error(ordersError.message);
      }

      if (paymentsError) {
        throw new Error(paymentsError.message);
      }

      const orderTransactions = (carnetOrders ?? []).map((order: any) => ({
        id: `order:${order.id}`,
        createdAt: order.created_at as string,
        description: `Order #${String(order.id).slice(0, 8).toUpperCase()}`,
        amount: Number(order.total_price ?? 0),
        kind: "debt" as const,
      }));

      const paymentTransactions = (payments ?? []).map((payment: any) => ({
        id: `payment:${payment.id}`,
        createdAt: payment.created_at as string,
        description: "Payment Received",
        amount: Number(payment.amount_paid ?? 0),
        kind: "payment" as const,
      }));

      const transactions = [...orderTransactions, ...paymentTransactions].sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      });

      return {
        customer: {
          id: customer.id as string,
          phone: customer.customer_phone as string,
          name: (customer.customer_name as string | null) ?? "Unnamed Customer",
          cin: (customer.customer_cin as string | null) ?? "—",
          currentDebt: Number(customer.current_debt ?? 0),
          maxLimit: Number(customer.max_limit ?? 0),
        },
        transactions,
      };
    } catch (error) {
      console.error("getCarnetCustomerLedger failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to load customer ledger.");
    }
  });

export const recordVendorCarnetPayment = createServerFn({ method: "POST" })
  .inputValidator((input) => recordVendorCarnetPaymentInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const vendor = await getActiveVendor();

      if (!vendor?.id) {
        throw new Error("No active vendor found.");
      }

      const { data: rpcResult, error } = await (supabaseAdmin as any).rpc("record_vendor_carnet_payment", {
        p_vendor_id: vendor.id,
        p_customer_phone: data.customerPhone,
        p_amount_paid: data.amountPaid,
      });

      if (error) {
        throw new Error(error.message);
      }

      const row = Array.isArray(rpcResult) ? rpcResult[0] : null;

      return {
        ok: true as const,
        paymentId: (row?.payment_id as string | undefined) ?? null,
        newCurrentDebt: Number(row?.new_current_debt ?? 0),
      };
    } catch (error) {
      console.error("recordVendorCarnetPayment failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to record payment.");
    }
  });

export const getCustomerCarnetOverview = createServerFn({ method: "POST" })
  .inputValidator((input) => getCustomerCarnetOverviewInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: carnetRow, error: carnetError } = await (supabaseAdmin as any)
        .from("vendor_carnet")
        .select("vendor_id, customer_phone, current_debt, max_limit, status")
        .eq("customer_phone", data.customerPhone)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (carnetError) {
        throw new Error(carnetError.message);
      }

      if (!carnetRow?.vendor_id) {
        return { carnet: null, transactions: [] as Array<any> };
      }

      const [{ data: carnetOrders, error: ordersError }, { data: payments, error: paymentsError }] =
        await Promise.all([
          (supabaseAdmin as any)
            .from("orders")
            .select("id, total_price, created_at")
            .eq("vendor_id", carnetRow.vendor_id)
            .eq("customer_phone", data.customerPhone)
            .eq("status", "delivered")
            .eq("payment_method", "Carnet")
            .order("created_at", { ascending: false }),
          (supabaseAdmin as any)
            .from("carnet_payments")
            .select("id, amount_paid, created_at")
            .eq("vendor_id", carnetRow.vendor_id)
            .eq("customer_phone", data.customerPhone)
            .order("created_at", { ascending: false }),
        ]);

      if (ordersError) {
        throw new Error(ordersError.message);
      }

      if (paymentsError) {
        throw new Error(paymentsError.message);
      }

      const orderTransactions = (carnetOrders ?? []).map((order: any) => ({
        id: `order:${order.id}`,
        createdAt: order.created_at as string,
        description: `Order #${String(order.id).slice(0, 8).toUpperCase()}`,
        amount: Number(order.total_price ?? 0),
        kind: "debt" as const,
      }));

      const paymentTransactions = (payments ?? []).map((payment: any) => ({
        id: `payment:${payment.id}`,
        createdAt: payment.created_at as string,
        description: "Payment Received",
        amount: Number(payment.amount_paid ?? 0),
        kind: "payment" as const,
      }));

      const transactions = [...orderTransactions, ...paymentTransactions].sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      });

      return {
        carnet: {
          customerPhone: carnetRow.customer_phone as string,
          currentDebt: Number(carnetRow.current_debt ?? 0),
          maxLimit: Number(carnetRow.max_limit ?? 0),
        },
        transactions,
      };
    } catch (error) {
      console.error("getCustomerCarnetOverview failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to load your carnet.");
    }
  });
