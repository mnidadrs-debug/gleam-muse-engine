import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const productCategorySchema = z.enum(["Vegetables", "Fruits", "Dairy", "Bakery", "Pantry"]);

const optionalNeighborhoodSchema = z.object({
  neighborhoodId: z.string().uuid().nullable().optional(),
});

const categoryInputSchema = z.object({
  nameEn: z.string().trim().min(1).max(120),
  nameFr: z.string().trim().min(1).max(120),
  nameAr: z.string().trim().min(1).max(120),
  imageUrl: z.string().url().max(2000).nullable(),
  iconName: z.string().trim().max(120).nullable(),
  accentColor: z.string().trim().min(4).max(32).default("#f3f4f6"),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

const updateCategoryInputSchema = categoryInputSchema.extend({
  id: z.string().uuid(),
});

const categoryPageInputSchema = z.object({
  categoryId: z.string().uuid(),
  neighborhoodId: z.string().uuid().nullable().optional(),
});

type CategoryRow = {
  id: string;
  name_en: string;
  name_fr: string;
  name_ar: string;
  image_url: string | null;
  icon_name: string | null;
  accent_color: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

type MasterProductRow = {
  id: string;
  product_name: string;
  name_fr: string | null;
  name_ar: string | null;
  image_url: string | null;
  measurement_unit: "Kg" | "Liter" | "Piece" | "Pack";
  created_at: string;
};

type ProductCategoryJoin = {
  category_id: string | null;
  is_active: boolean;
};

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

async function getNeighborhoodVendorIds(neighborhoodId?: string | null) {
  if (!neighborhoodId) {
    return null;
  }

  const { data, error } = await (supabaseAdmin as any)
    .from("neighborhoods")
    .select("vendor_id")
    .eq("id", neighborhoodId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.vendor_id) {
    return [];
  }

  return [data.vendor_id] as string[];
}

export const listAdminCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await (supabaseAdmin as any)
    .from("categories")
    .select("id, name_en, name_fr, name_ar, image_url, icon_name, accent_color, sort_order, is_active, created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CategoryRow[];
});

export const createCategory = createServerFn({ method: "POST" })
  .inputValidator((input) => categoryInputSchema.parse(input))
  .handler(async ({ data }) => {
    const parsedCategory = productCategorySchema.safeParse(data.nameEn);
    if (!parsedCategory.success) {
      throw new Error("Category English name must be one of: Vegetables, Fruits, Dairy, Bakery, Pantry.");
    }

    const { data: inserted, error } = await (supabaseAdmin as any)
      .from("categories")
      .insert({
        name_en: parsedCategory.data,
        name_fr: data.nameFr,
        name_ar: data.nameAr,
        image_url: data.imageUrl,
        icon_name: data.iconName,
        accent_color: data.accentColor,
        sort_order: data.sortOrder,
        is_active: data.isActive,
      })
      .select("id, name_en, name_fr, name_ar, image_url, icon_name, accent_color, sort_order, is_active, created_at")
      .single();

    if (error || !inserted) {
      throw new Error(error?.message ?? "Failed to create category.");
    }

    return inserted as CategoryRow;
  });

export const updateCategory = createServerFn({ method: "POST" })
  .inputValidator((input) => updateCategoryInputSchema.parse(input))
  .handler(async ({ data }) => {
    const parsedCategory = productCategorySchema.safeParse(data.nameEn);
    if (!parsedCategory.success) {
      throw new Error("Category English name must be one of: Vegetables, Fruits, Dairy, Bakery, Pantry.");
    }

    const { data: updated, error } = await (supabaseAdmin as any)
      .from("categories")
      .update({
        name_en: parsedCategory.data,
        name_fr: data.nameFr,
        name_ar: data.nameAr,
        image_url: data.imageUrl,
        icon_name: data.iconName,
        accent_color: data.accentColor,
        sort_order: data.sortOrder,
        is_active: data.isActive,
      })
      .eq("id", data.id)
      .select("id, name_en, name_fr, name_ar, image_url, icon_name, accent_color, sort_order, is_active, created_at")
      .single();

    if (error || !updated) {
      throw new Error(error?.message ?? "Failed to update category.");
    }

    return updated as CategoryRow;
  });

export const listActiveCategories = createServerFn({ method: "POST" })
  .inputValidator((input) => optionalNeighborhoodSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: categories, error: categoriesError } = await (supabaseAdmin as any)
      .from("categories")
      .select("id, name_en, name_fr, name_ar, image_url, icon_name, accent_color, sort_order, is_active, created_at")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (categoriesError) {
      throw new Error(categoriesError.message);
    }

    const vendorIds = await getNeighborhoodVendorIds(data.neighborhoodId ?? null);

    const vendorProductsQuery = (supabaseAdmin as any)
      .from("vendor_products")
      .select("master_product_id, master_products:master_product_id(category_id, is_active)")
      .eq("is_available", true)
      .eq("master_products.is_active", true);

    if (vendorIds) {
      if (vendorIds.length === 0) {
        return [];
      }
      vendorProductsQuery.in("vendor_id", vendorIds);
    }

    const { data: vendorProducts, error: vendorProductsError } = await vendorProductsQuery;

    if (vendorProductsError) {
      throw new Error(vendorProductsError.message);
    }

    const productsByCategory = new Map<string, Set<string>>();

    for (const row of (vendorProducts ?? []) as Array<{
      master_product_id: string;
      master_products: ProductCategoryJoin | null;
    }>) {
      const categoryId = row.master_products?.category_id;
      if (!categoryId) {
        continue;
      }

      if (!productsByCategory.has(categoryId)) {
        productsByCategory.set(categoryId, new Set<string>());
      }

      productsByCategory.get(categoryId)!.add(row.master_product_id);
    }

    return ((categories ?? []) as CategoryRow[])
      .map((category) => ({
        ...category,
        product_count: productsByCategory.get(category.id)?.size ?? 0,
      }))
      .filter((category) => category.product_count > 0);
  });

export const getCategoryProducts = createServerFn({ method: "POST" })
  .inputValidator((input) => categoryPageInputSchema.parse(input))
  .handler(async ({ data }) => {
    const [{ data: category, error: categoryError }, vendorIds] = await Promise.all([
      (supabaseAdmin as any)
        .from("categories")
        .select("id, name_en, name_fr, name_ar, image_url, icon_name, accent_color, sort_order, is_active, created_at")
        .eq("id", data.categoryId)
        .eq("is_active", true)
        .single(),
      getNeighborhoodVendorIds(data.neighborhoodId ?? null),
    ]);

    if (categoryError) {
      throw new Error(categoryError.message);
    }

    if (!category?.id) {
      return {
        category: null,
        items: [] as Array<{
          id: string;
          name: string;
          nameFr: string | null;
          nameAr: string | null;
          imageUrl: string | null;
          price: number;
          measurementUnit: "Kg" | "Liter" | "Piece" | "Pack";
          createdAt: string;
        }>,
      };
    }

    const itemsQuery = (supabaseAdmin as any)
      .from("vendor_products")
      .select(
        "master_product_id, vendor_price, master_products:master_product_id(id, product_name, name_fr, name_ar, image_url, measurement_unit, created_at, is_active, category_id)",
      )
      .eq("is_available", true)
      .eq("master_products.is_active", true)
      .eq("master_products.category_id", data.categoryId)
      .order("created_at", { ascending: false });

    if (vendorIds) {
      if (vendorIds.length === 0) {
        return {
          category,
          items: [],
        };
      }
      itemsQuery.in("vendor_id", vendorIds);
    }

    const { data: productRows, error: productRowsError } = await itemsQuery;

    if (productRowsError) {
      throw new Error(productRowsError.message);
    }

    const deduped = new Map<string, {
      id: string;
      name: string;
      nameFr: string | null;
      nameAr: string | null;
      imageUrl: string | null;
      price: number;
      measurementUnit: "Kg" | "Liter" | "Piece" | "Pack";
      createdAt: string;
    }>();

    for (const row of (productRows ?? []) as Array<{
      master_product_id: string;
      vendor_price: number;
      master_products: {
        id: string;
        product_name: string;
        name_fr: string | null;
        name_ar: string | null;
        image_url: string | null;
        measurement_unit: "Kg" | "Liter" | "Piece" | "Pack";
        created_at: string;
      } | null;
    }>) {
      const product = row.master_products;
      if (!product?.id || deduped.has(product.id)) {
        continue;
      }

      deduped.set(product.id, {
        id: product.id,
        name: product.product_name,
        nameFr: product.name_fr,
        nameAr: product.name_ar,
        imageUrl: product.image_url,
        price: Number(row.vendor_price ?? 0),
        measurementUnit: product.measurement_unit,
        createdAt: product.created_at,
      });
    }

    return {
      category,
      items: Array.from(deduped.values()),
    };
  });

export const getCategoryById = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ categoryId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: category, error } = await (supabaseAdmin as any)
      .from("categories")
      .select("id, name_en, name_fr, name_ar, image_url, icon_name, accent_color, sort_order, is_active, created_at")
      .eq("id", data.categoryId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return (category ?? null) as CategoryRow | null;
  });

export const listCategoryMasterProducts = createServerFn({ method: "POST" })
  .inputValidator(
    (input) =>
      z
        .object({
          categoryId: z.string().uuid(),
          neighborhoodId: z.string().uuid().nullable().optional(),
        })
        .parse(input),
  )
  .handler(async ({ data }) => {
    const nowIso = new Date().toISOString();
    const vendorIds = await getNeighborhoodVendorIds(data.neighborhoodId ?? null);

    const itemsQuery = (supabaseAdmin as any)
      .from("vendor_products")
      .select(
        "master_product_id, vendor_price, master_products:master_product_id(id, product_name, name_fr, name_ar, image_url, measurement_unit, created_at, is_active, category_id)",
      )
      .eq("is_available", true)
      .or(`is_flash_sale.is.false,is_flash_sale.is.null,and(is_flash_sale.eq.true,flash_sale_end_time.lte.${nowIso})`)
      .eq("master_products.is_active", true)
      .eq("master_products.category_id", data.categoryId)
      .order("created_at", { ascending: false });

    if (vendorIds) {
      if (vendorIds.length === 0) {
        return [];
      }
      itemsQuery.in("vendor_id", vendorIds);
    }

    const { data: productRows, error: productRowsError } = await itemsQuery;

    if (productRowsError) {
      throw new Error(productRowsError.message);
    }

    const deduped = new Map<
      string,
      {
        id: string;
        product_name: string;
        name_fr: string | null;
        name_ar: string | null;
        image_url: string | null;
        measurement_unit: "Kg" | "Liter" | "Piece" | "Pack";
        created_at: string;
        price: number;
      }
    >();

    for (const row of (productRows ?? []) as Array<{
      master_product_id: string;
      vendor_price: number;
      master_products: {
        id: string;
        product_name: string;
        name_fr: string | null;
        name_ar: string | null;
        image_url: string | null;
        measurement_unit: "Kg" | "Liter" | "Piece" | "Pack";
        created_at: string;
      } | null;
    }>) {
      const product = row.master_products;
      if (!product?.id || deduped.has(product.id)) {
        continue;
      }

      deduped.set(product.id, {
        id: product.id,
        product_name: product.product_name,
        name_fr: product.name_fr,
        name_ar: product.name_ar,
        image_url: product.image_url,
        measurement_unit: product.measurement_unit,
        created_at: product.created_at,
        price: Number(row.vendor_price ?? 0),
      });
    }

    return Array.from(deduped.values()) as Array<MasterProductRow & { price: number }>;
  });
