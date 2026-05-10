import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const createCommuneInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const createNeighborhoodInputSchema = z.object({
  communeId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  deliveryFee: z.coerce.number().min(0).max(100000).default(0),
});

const updateCommuneInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
});

const updateNeighborhoodInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  deliveryFee: z.coerce.number().min(0).max(100000).default(0),
});

type CommuneRow = {
  id: string;
  name: string;
};

type NeighborhoodRow = {
  id: string;
  name: string;
  commune_id: string;
  delivery_fee: number;
  vendor_id: string | null;
};

export type ServiceZoneTree = Array<{
  id: string;
  name: string;
  neighborhoods: Array<{
    id: string;
    name: string;
    communeId: string;
    deliveryFee: number;
    vendorId: string | null;
  }>;
}>;

export const listServiceZones = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const [{ data: communes, error: communesError }, { data: neighborhoods, error: neighborhoodsError }] =
      await Promise.all([
        (supabaseAdmin as any).from("communes").select("id, name").order("name", { ascending: true }),
        (supabaseAdmin as any)
          .from("neighborhoods")
          .select("id, name, commune_id, delivery_fee, vendor_id")
          .order("name", { ascending: true }),
      ]);

    if (communesError) {
      throw new Error(communesError.message);
    }

    if (neighborhoodsError) {
      throw new Error(neighborhoodsError.message);
    }

    const groupedNeighborhoods = new Map<string, ServiceZoneTree[number]["neighborhoods"]>();

    for (const neighborhood of (neighborhoods ?? []) as NeighborhoodRow[]) {
      const current = groupedNeighborhoods.get(neighborhood.commune_id) ?? [];
      current.push({
        id: neighborhood.id,
        name: neighborhood.name,
        communeId: neighborhood.commune_id,
        deliveryFee: Number(neighborhood.delivery_fee ?? 0),
        vendorId: neighborhood.vendor_id,
      });
      groupedNeighborhoods.set(neighborhood.commune_id, current);
    }

    return ((communes ?? []) as CommuneRow[]).map((commune) => ({
      id: commune.id,
      name: commune.name,
      neighborhoods: groupedNeighborhoods.get(commune.id) ?? [],
    }));
  } catch (error) {
    console.error("listServiceZones failed:", error);
    throw new Error("Failed to load service zones.");
  }
});

export const createCommune = createServerFn({ method: "POST" })
  .inputValidator((input) => createCommuneInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: inserted, error } = await (supabaseAdmin as any)
        .from("communes")
        .insert({ name: data.name })
        .select("id, name")
        .single();

      if (error || !inserted?.id) {
        throw new Error(error?.message ?? "Failed to create commune.");
      }

      return {
        id: (inserted as CommuneRow).id,
        name: (inserted as CommuneRow).name,
      };
    } catch (error) {
      console.error("createCommune failed:", error);
      throw new Error("Failed to create commune.");
    }
  });

export const createNeighborhood = createServerFn({ method: "POST" })
  .inputValidator((input) => createNeighborhoodInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: inserted, error } = await (supabaseAdmin as any)
        .from("neighborhoods")
        .insert({
          commune_id: data.communeId,
          name: data.name,
          delivery_fee: data.deliveryFee,
        })
        .select("id, name, commune_id, delivery_fee")
        .single();

      if (error || !inserted?.id) {
        throw new Error(error?.message ?? "Failed to create neighborhood.");
      }

      return {
        id: (inserted as NeighborhoodRow).id,
        name: (inserted as NeighborhoodRow).name,
        communeId: (inserted as NeighborhoodRow).commune_id,
        deliveryFee: Number((inserted as NeighborhoodRow).delivery_fee ?? 0),
      };
    } catch (error) {
      console.error("createNeighborhood failed:", error);
      throw new Error("Failed to create neighborhood.");
    }
  });

export const updateCommune = createServerFn({ method: "POST" })
  .inputValidator((input) => updateCommuneInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: updated, error } = await (supabaseAdmin as any)
        .from("communes")
        .update({ name: data.name })
        .eq("id", data.id)
        .select("id, name")
        .single();

      if (error || !updated?.id) {
        throw new Error(error?.message ?? "Failed to update commune.");
      }

      return {
        id: (updated as CommuneRow).id,
        name: (updated as CommuneRow).name,
      };
    } catch (error) {
      console.error("updateCommune failed:", error);
      throw new Error("Failed to update commune.");
    }
  });

export const updateNeighborhood = createServerFn({ method: "POST" })
  .inputValidator((input) => updateNeighborhoodInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: updated, error } = await (supabaseAdmin as any)
        .from("neighborhoods")
        .update({ name: data.name, delivery_fee: data.deliveryFee })
        .eq("id", data.id)
        .select("id, name, commune_id, delivery_fee")
        .single();

      if (error || !updated?.id) {
        throw new Error(error?.message ?? "Failed to update neighborhood.");
      }

      return {
        id: (updated as NeighborhoodRow).id,
        name: (updated as NeighborhoodRow).name,
        communeId: (updated as NeighborhoodRow).commune_id,
        deliveryFee: Number((updated as NeighborhoodRow).delivery_fee ?? 0),
      };
    } catch (error) {
      console.error("updateNeighborhood failed:", error);
      throw new Error("Failed to update neighborhood.");
    }
  });