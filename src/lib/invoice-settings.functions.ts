import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const updateInvoiceSettingsInputSchema = z.object({
  id: z.string().uuid(),
  storeName: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(220),
  phone: z.string().trim().min(3).max(30),
  taxId: z.string().trim().max(120).nullable(),
  footerMessage: z.string().trim().min(1).max(240),
});

export type InvoiceSettingsRecord = {
  id: string;
  store_name: string;
  address: string;
  phone: string;
  tax_id: string | null;
  footer_message: string;
  created_at: string;
  updated_at: string;
};

const DEFAULT_INVOICE_SETTINGS = {
  store_name: "Bzaf Fresh",
  address: "Casablanca, Morocco",
  phone: "+212000000000",
  tax_id: null,
  footer_message: "Thank you for shopping with Bzaf Fresh!",
};

export const getInvoiceSettings = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { data: row, error } = await (supabaseAdmin as any)
      .from("invoice_settings")
      .select("id, store_name, address, phone, tax_id, footer_message, created_at, updated_at")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (row) {
      return row as InvoiceSettingsRecord;
    }

    const { data: inserted, error: insertError } = await (supabaseAdmin as any)
      .from("invoice_settings")
      .insert(DEFAULT_INVOICE_SETTINGS)
      .select("id, store_name, address, phone, tax_id, footer_message, created_at, updated_at")
      .single();

    if (insertError || !inserted?.id) {
      throw new Error(insertError?.message ?? "Unable to initialize invoice settings.");
    }

    return inserted as InvoiceSettingsRecord;
  } catch (error) {
    console.error("getInvoiceSettings failed:", error);
    throw new Error("Failed to load receipt settings.");
  }
});

export const updateInvoiceSettings = createServerFn({ method: "POST" })
  .inputValidator((input) => updateInvoiceSettingsInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const payload = {
        store_name: data.storeName,
        address: data.address,
        phone: data.phone,
        tax_id: data.taxId,
        footer_message: data.footerMessage,
      };

      const { data: updated, error } = await (supabaseAdmin as any)
        .from("invoice_settings")
        .update(payload)
        .eq("id", data.id)
        .select("id, store_name, address, phone, tax_id, footer_message, created_at, updated_at")
        .single();

      if (error || !updated?.id) {
        throw new Error(error?.message ?? "Receipt settings update failed.");
      }

      return updated as InvoiceSettingsRecord;
    } catch (error) {
      console.error("updateInvoiceSettings failed:", error);
      throw new Error("Failed to save receipt settings.");
    }
  });
