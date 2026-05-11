import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const getCustomerProfileInputSchema = z.object({
  phoneNumber: z.string().trim().regex(/^\+212[0-9]{9}$/),
});

const createOtpRequestInputSchema = z.object({
  phoneNumber: z.string().trim().regex(/^\+212[0-9]{9}$/),
});

const verifyOtpCodeInputSchema = z.object({
  phoneNumber: z.string().trim().regex(/^\+212[0-9]{9}$/),
  otpCode: z.string().trim().regex(/^[0-9]{4}$/),
});

const upsertCustomerNeighborhoodInputSchema = z.object({
  phoneNumber: z.string().trim().regex(/^\+212[0-9]{9}$/),
  neighborhoodId: z.string().uuid(),
});

type CustomerRow = {
  id: string;
  phone: string | null;
  full_name: string | null;
  address: string | null;
  neighborhood_id: string | null;
};

type LegacyCustomerRow = {
  id: string;
  phone_number: string;
  full_name: string | null;
  saved_instructions: string | null;
  neighborhood_id: string | null;
};

type OtpRequestRow = {
  id: string;
  otp_code: string;
};

export const createOtpRequest = createServerFn({ method: "POST" })
  .inputValidator((input) => createOtpRequestInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const otpCode = String(Math.floor(1000 + Math.random() * 9000));

      const { error } = await (supabaseAdmin as any).from("otp_requests").insert({
        phone_number: data.phoneNumber,
        otp_code: otpCode,
      });

      if (error) {
        throw new Error(error.message);
      }

      return {
        phoneNumber: data.phoneNumber,
        otpCode,
      };
    } catch (error) {
      console.error("createOtpRequest failed:", error);
      throw new Error("Failed to generate OTP request.");
    }
  });

export const verifyOtpCode = createServerFn({ method: "POST" })
  .inputValidator((input) => verifyOtpCodeInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: otpRequest, error: fetchError } = await (supabaseAdmin as any)
        .from("otp_requests")
        .select("id, otp_code")
        .eq("phone_number", data.phoneNumber)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (!otpRequest) {
        return { verified: false as const };
      }

      const latestOtp = otpRequest as OtpRequestRow;
      if (latestOtp.otp_code !== data.otpCode) {
        return { verified: false as const };
      }

      const { error: deleteError } = await (supabaseAdmin as any)
        .from("otp_requests")
        .delete()
        .eq("id", latestOtp.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      return { verified: true as const };
    } catch (error) {
      console.error("verifyOtpCode failed:", error);
      throw new Error("Failed to verify OTP code.");
    }
  });

export const getCustomerProfileByPhone = createServerFn({ method: "POST" })
  .inputValidator((input) => getCustomerProfileInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: profile, error } = await (supabaseAdmin as any)
        .from("profiles")
        .select("id, phone, full_name, address, neighborhood_id")
        .eq("phone", data.phoneNumber)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      const profileRow = profile as CustomerRow | null;

      const { data: legacyCustomer, error: legacyError } = await (supabaseAdmin as any)
        .from("customers")
        .select("id, phone_number, full_name, saved_instructions, neighborhood_id")
        .eq("phone_number", data.phoneNumber)
        .maybeSingle();

      if (legacyError) {
        throw new Error(legacyError.message);
      }

      const legacyRow = (legacyCustomer as LegacyCustomerRow | null) ?? null;

      if (profileRow || legacyRow) {
        return {
          id: profileRow?.id ?? legacyRow?.id ?? null,
          phoneNumber: profileRow?.phone ?? legacyRow?.phone_number ?? data.phoneNumber,
          fullName: profileRow?.full_name?.trim() || legacyRow?.full_name?.trim() || null,
          address: profileRow?.address ?? null,
          savedInstructions: legacyRow?.saved_instructions ?? null,
          neighborhoodId: profileRow?.neighborhood_id ?? legacyRow?.neighborhood_id ?? null,
        };
      }

      return null;
    } catch (error) {
      console.error("getCustomerProfileByPhone failed:", error);
      throw new Error("Failed to load customer profile.");
    }
  });

export const upsertCustomerNeighborhood = createServerFn({ method: "POST" })
  .inputValidator((input) => upsertCustomerNeighborhoodInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: updatedProfiles, error } = await (supabaseAdmin as any)
        .from("profiles")
        .update({ neighborhood_id: data.neighborhoodId })
        .eq("phone", data.phoneNumber)
        .select("id");

      if (error) {
        throw new Error(error.message);
      }

      const profileId = Array.isArray(updatedProfiles) && updatedProfiles[0]?.id ? String(updatedProfiles[0].id) : null;

      if (!profileId) {
        return { ok: true, fallback: true as const };
      }

      const { error: legacyError } = await (supabaseAdmin as any).from("customers").upsert(
        {
          user_id: profileId,
          phone_number: data.phoneNumber,
          neighborhood_id: data.neighborhoodId,
        },
        { onConflict: "user_id", ignoreDuplicates: false },
      );

      if (legacyError) {
        console.error("Legacy customer sync failed:", legacyError.message);
        return { ok: true, fallback: true as const };
      }

      return { ok: true };
    } catch (error) {
      console.error("upsertCustomerNeighborhood failed:", error);
      return { ok: false, fallback: true as const };
    }
  });
