import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const adInputSchema = z.object({
  imageUrl: z.string().url().max(2000),
  linkUrl: z.string().trim().max(2000).optional().nullable(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

const updateAdInputSchema = adInputSchema.extend({
  id: z.string().uuid(),
});

const announcementInputSchema = z.object({
  content: z.string().trim().min(1).max(300),
  contentFr: z.string().trim().min(1).max(300),
  contentAr: z.string().trim().min(1).max(300),
  isActive: z.boolean().default(true),
  bgColor: z.string().trim().min(4).max(20).default("#deff9a"),
  textColor: z.string().trim().min(4).max(20).default("#000000"),
});

const updateAnnouncementInputSchema = announcementInputSchema.extend({
  id: z.string().uuid(),
});

const idInputSchema = z.object({
  id: z.string().uuid(),
});

export const listSiteAds = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await (supabaseAdmin as any)
    .from("site_ads")
    .select("id, image_url, link_url, sort_order, is_active, created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createSiteAd = createServerFn({ method: "POST" })
  .inputValidator((input) => adInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: inserted, error } = await (supabaseAdmin as any)
      .from("site_ads")
      .insert({
        image_url: data.imageUrl,
        link_url: data.linkUrl?.trim() || null,
        sort_order: data.sortOrder,
        is_active: data.isActive,
      })
      .select("id, image_url, link_url, sort_order, is_active, created_at")
      .single();

    if (error || !inserted) throw new Error(error?.message ?? "Failed to create ad.");
    return inserted;
  });

export const updateSiteAd = createServerFn({ method: "POST" })
  .inputValidator((input) => updateAdInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: updated, error } = await (supabaseAdmin as any)
      .from("site_ads")
      .update({
        image_url: data.imageUrl,
        link_url: data.linkUrl?.trim() || null,
        sort_order: data.sortOrder,
        is_active: data.isActive,
      })
      .eq("id", data.id)
      .select("id, image_url, link_url, sort_order, is_active, created_at")
      .single();

    if (error || !updated) throw new Error(error?.message ?? "Failed to update ad.");
    return updated;
  });

export const deleteSiteAd = createServerFn({ method: "POST" })
  .inputValidator((input) => idInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any).from("site_ads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAnnouncements = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await (supabaseAdmin as any)
    .from("announcements")
    .select("id, content, content_fr, content_ar, is_active, bg_color, text_color, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((input) => announcementInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: inserted, error } = await (supabaseAdmin as any)
      .from("announcements")
      .insert({
        content: data.content,
        content_fr: data.contentFr,
        content_ar: data.contentAr,
        is_active: data.isActive,
        bg_color: data.bgColor,
        text_color: data.textColor,
      })
      .select("id, content, content_fr, content_ar, is_active, bg_color, text_color, created_at")
      .single();

    if (error || !inserted) throw new Error(error?.message ?? "Failed to create announcement.");
    return inserted;
  });

export const updateAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((input) => updateAnnouncementInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: updated, error } = await (supabaseAdmin as any)
      .from("announcements")
      .update({
        content: data.content,
        content_fr: data.contentFr,
        content_ar: data.contentAr,
        is_active: data.isActive,
        bg_color: data.bgColor,
        text_color: data.textColor,
      })
      .eq("id", data.id)
      .select("id, content, content_fr, content_ar, is_active, bg_color, text_color, created_at")
      .single();

    if (error || !updated) throw new Error(error?.message ?? "Failed to update announcement.");
    return updated;
  });

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((input) => idInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any).from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getActiveAdsAndAnnouncements = createServerFn({ method: "GET" }).handler(async () => {
  const [adsResponse, announcementsResponse] = await Promise.all([
    (supabaseAdmin as any)
      .from("site_ads")
      .select("id, image_url, link_url, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    (supabaseAdmin as any)
      .from("announcements")
      .select("id, content, content_fr, content_ar, bg_color, text_color")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  if (adsResponse.error) throw new Error(adsResponse.error.message);
  if (announcementsResponse.error) throw new Error(announcementsResponse.error.message);

  return {
    ads: adsResponse.data ?? [],
    announcements: announcementsResponse.data ?? [],
  };
});