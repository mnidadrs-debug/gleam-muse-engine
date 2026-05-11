import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const measurementUnitSchema = z.enum(["Kg", "Liter", "Piece", "Pack", "Gram", "Bunch", "Tray", "Box"]);
const productCategorySchema = z.enum([
  "Groceries",
  "Vegetables & Fruits",
  "Meat & Poultry",
  "Bakery & Pastry",
  "Dairy & Eggs",
  "Drinks & Water",
  "Cleaning Supplies",
]);

const vendorInventoryInputSchema = z.object({
  phoneNumber: z.string().trim().regex(/^\+212[0-9]{9}$/).optional(),
});

const createMasterProductInputSchema = z.object({
  name: z.string().trim().min(1).max(140),
  nameFr: z.string().trim().min(1).max(140),
  nameAr: z.string().trim().min(1).max(140),
  categoryId: z.string().uuid(),
  measurementUnit: measurementUnitSchema,
  popularityScore: z.number().int().min(0).max(1_000_000),
  imageUrl: z.string().url().max(2000).nullable(),
});

const uploadMasterProductImageInputSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(120),
  dataUrl: z.string().trim().min(1),
});

const createDbError = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    if (error.message.startsWith("DB Error:")) {
      return error;
    }
    return new Error(`DB Error: ${error.message}`);
  }

  return new Error(`DB Error: ${fallback}`);
};

const updateMasterProductInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(140),
  nameFr: z.string().trim().min(1).max(140),
  nameAr: z.string().trim().min(1).max(140),
  categoryId: z.string().uuid(),
  measurementUnit: measurementUnitSchema,
  popularityScore: z.number().int().min(0).max(1_000_000),
  imageUrl: z.string().url().max(2000).nullable(),
});

const archiveMasterProductInputSchema = z.object({
  id: z.string().uuid(),
});

const customerCatalogInputSchema = z.object({
  neighborhoodId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(24).default(12),
});

const customerProductDetailInputSchema = z.object({
  productId: z.string().uuid(),
  neighborhoodId: z.string().uuid().nullable().optional(),
});

const upsertVendorProductInputSchema = z.object({
  masterProductId: z.string().uuid(),
  vendorPrice: z.number().min(0),
  isAvailable: z.boolean(),
});

const updateVendorFlashSaleInputSchema = z.object({
  masterProductId: z.string().uuid(),
  enabled: z.boolean(),
  flashSalePrice: z.number().positive().nullable(),
  flashSaleEndTime: z.string().datetime().nullable(),
});

const activeFlashDealsInputSchema = z.object({
  neighborhoodId: z.string().uuid(),
});

type MasterProductRow = {
  id: string;
  product_name: string;
  name_fr: string | null;
  name_ar: string | null;
  category_id: string | null;
  category: ProductCategory;
  measurement_unit: MeasurementUnit;
  image_url: string | null;
  popularity_score: number;
  is_active: boolean;
  created_at: string;
};

type VendorProductRow = {
  id: string;
  master_product_id: string;
  vendor_price: number;
  is_available: boolean;
  is_flash_sale: boolean;
  flash_sale_price: number | null;
  flash_sale_end_time: string | null;
};

type VendorRow = {
  id: string;
  store_name: string;
  vendor_type: "general" | "specialized";
  assigned_categories: string[];
};

type VendorType = "general" | "specialized";

export const listMasterProducts = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from("master_products")
      .select(
        "id, product_name, name_fr, name_ar, category_id, category, measurement_unit, image_url, popularity_score, is_active, created_at",
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as MasterProductRow[];
  } catch (error) {
    console.error("listMasterProducts failed:", error);
    throw new Error("Failed to load master products.");
  }
});

export const createMasterProduct = createServerFn({ method: "POST" })
  .inputValidator((input) => createMasterProductInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: categoryRow, error: categoryError } = await (supabaseAdmin as any)
        .from("categories")
        .select("name_en")
        .eq("id", data.categoryId)
        .maybeSingle();

      if (categoryError || !categoryRow?.name_en) {
        throw createDbError(categoryError ?? new Error("Invalid category selected."), "Invalid category selected.");
      }

      const parsedCategory = productCategorySchema.safeParse(categoryRow.name_en);
      if (!parsedCategory.success) {
        throw new Error(`Selected category '${categoryRow.name_en}' is not supported by master_products.category enum.`);
      }

      const { data: inserted, error } = await (supabaseAdmin as any)
        .from("master_products")
        .insert({
          product_name: data.name,
          name_fr: data.nameFr,
          name_ar: data.nameAr,
          category_id: data.categoryId,
          category: parsedCategory.data,
          measurement_unit: data.measurementUnit,
          popularity_score: data.popularityScore,
          image_url: data.imageUrl,
          is_active: true,
        })
        .select(
          "id, product_name, name_fr, name_ar, category_id, category, measurement_unit, image_url, popularity_score, is_active, created_at",
        )
        .single();

      if (error || !inserted?.id) {
        throw createDbError(error ?? new Error("Master product insert failed."), "Master product insert failed.");
      }

      return inserted as MasterProductRow;
    } catch (error) {
      console.error("createMasterProduct failed:", error);
      throw createDbError(error, "Failed to save master product.");
    }
  });

export const uploadMasterProductImage = createServerFn({ method: "POST" })
  .inputValidator((input) => uploadMasterProductImageInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      if (!data.contentType.startsWith("image/")) {
        throw new Error("Only image uploads are allowed.");
      }

      const commaIndex = data.dataUrl.indexOf(",");
      if (commaIndex === -1) {
        throw new Error("Invalid image payload.");
      }

      const base64Payload = data.dataUrl.slice(commaIndex + 1);
      const bytes = Uint8Array.from(Buffer.from(base64Payload, "base64"));

      const extensionFromName = data.fileName.split(".").pop()?.toLowerCase() ?? "jpg";
      const safeBaseName = data.fileName
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .slice(0, 60);
      const generatedFileName = `${crypto.randomUUID()}-${safeBaseName || "product"}.${extensionFromName}`;
      const path = `master-products/${generatedFileName}`;

      const { data: uploadData, error: uploadError } = await (supabaseAdmin as any).storage
        .from("products")
        .upload(path, bytes, {
          contentType: data.contentType,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError || !uploadData?.path) {
        throw new Error(uploadError?.message ?? "Image upload failed.");
      }

      const { data: publicUrlData } = (supabaseAdmin as any).storage.from("products").getPublicUrl(uploadData.path);

      return {
        path: uploadData.path,
        publicUrl: publicUrlData.publicUrl,
      };
    } catch (error) {
      console.error("uploadMasterProductImage failed:", error);
      throw createDbError(error, "Failed to upload product image.");
    }
  });

export const updateMasterProduct = createServerFn({ method: "POST" })
  .inputValidator((input) => updateMasterProductInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: categoryRow, error: categoryError } = await (supabaseAdmin as any)
        .from("categories")
        .select("name_en")
        .eq("id", data.categoryId)
        .maybeSingle();

      if (categoryError || !categoryRow?.name_en) {
        throw createDbError(categoryError ?? new Error("Invalid category selected."), "Invalid category selected.");
      }

      const parsedCategory = productCategorySchema.safeParse(categoryRow.name_en);
      if (!parsedCategory.success) {
        throw new Error(`Selected category '${categoryRow.name_en}' is not supported by master_products.category enum.`);
      }

      const { data: updated, error } = await (supabaseAdmin as any)
        .from("master_products")
        .update({
          product_name: data.name,
          name_fr: data.nameFr,
          name_ar: data.nameAr,
          category_id: data.categoryId,
          category: parsedCategory.data,
          measurement_unit: data.measurementUnit,
          popularity_score: data.popularityScore,
          image_url: data.imageUrl,
        })
        .eq("id", data.id)
        .select(
          "id, product_name, name_fr, name_ar, category_id, category, measurement_unit, image_url, popularity_score, is_active, created_at",
        )
        .single();

      if (error || !updated?.id) {
        throw createDbError(error ?? new Error("Master product update failed."), "Master product update failed.");
      }

      return updated as MasterProductRow;
    } catch (error) {
      console.error("updateMasterProduct failed:", error);
      throw createDbError(error, "Failed to update master product.");
    }
  });

export const archiveMasterProduct = createServerFn({ method: "POST" })
  .inputValidator((input) => archiveMasterProductInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { error } = await (supabaseAdmin as any)
        .from("master_products")
        .update({ is_active: false })
        .eq("id", data.id)
        .eq("is_active", true);

      if (error) {
        throw new Error(error.message);
      }

      return { ok: true };
    } catch (error) {
      console.error("archiveMasterProduct failed:", error);
      throw new Error("Failed to archive master product.");
    }
  });

function getCurrentVendorQuery(phoneNumber?: string) {
  const query = (supabaseAdmin as any)
    .from("vendors")
    .select("id, store_name, vendor_type, assigned_categories")
    .eq("is_active", true);

  if (phoneNumber) {
    query.eq("phone_number", phoneNumber);
  }

  return query.order("created_at", { ascending: true }).limit(1).single();
}

export const getVendorInventoryData = createServerFn({ method: "POST" })
  .inputValidator((input) => vendorInventoryInputSchema.parse(input))
  .handler(async ({ data }) => {
  try {
    const { data: vendor, error: vendorError } = await getCurrentVendorQuery(data.phoneNumber);
    const resolvedVendorType: VendorType = (vendor?.vendor_type as VendorType | undefined) ?? "general";
    const resolvedAssignedCategories =
      resolvedVendorType === "specialized" ? ((vendor?.assigned_categories ?? []) as string[]) : [];

    if (vendorError || !vendor?.id) {
      return {
        vendor: null,
        products: [] as Array<{
          id: string;
          name: string;
          category: ProductCategory;
          measurementUnit: MeasurementUnit;
          vendorProductId: string | null;
          vendorPrice: number;
          isAvailable: boolean;
        }>,
      };
    }

    if (resolvedVendorType === "specialized" && resolvedAssignedCategories.length === 0) {
      return {
        vendor: vendor as VendorRow,
        products: [] as Array<{
          id: string;
          name: string;
          category: ProductCategory;
          measurementUnit: MeasurementUnit;
          vendorProductId: string | null;
          vendorPrice: number;
          isAvailable: boolean;
        }>,
      };
    }

    const masterProductsQuery = (supabaseAdmin as any)
      .from("master_products")
      .select("id, product_name, name_fr, name_ar, category_id, category, measurement_unit, image_url, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (resolvedVendorType === "specialized") {
      masterProductsQuery.in("category", resolvedAssignedCategories);
    }

    const [{ data: masterProducts, error: masterError }, { data: vendorProducts, error: vendorProductsError }] =
      await Promise.all([
        masterProductsQuery,
        (supabaseAdmin as any)
          .from("vendor_products")
          .select("id, master_product_id, vendor_price, is_available, is_flash_sale, flash_sale_price, flash_sale_end_time")
          .eq("vendor_id", vendor.id),
      ]);

    if (masterError) {
      throw new Error(masterError.message);
    }

    if (vendorProductsError) {
      throw new Error(vendorProductsError.message);
    }

    const vendorMap = new Map<string, VendorProductRow>(
      ((vendorProducts ?? []) as VendorProductRow[]).map((row) => [row.master_product_id, row]),
    );

    return {
      vendor: vendor as VendorRow,
      products: ((masterProducts ?? []) as MasterProductRow[]).map((masterProduct) => {
        const linked = vendorMap.get(masterProduct.id);
        return {
          id: masterProduct.id,
          name: masterProduct.product_name,
          nameFr: masterProduct.name_fr,
          nameAr: masterProduct.name_ar,
          categoryId: masterProduct.category_id,
          category: masterProduct.category,
          measurementUnit: masterProduct.measurement_unit,
          imageUrl: masterProduct.image_url,
          vendorProductId: linked?.id ?? null,
          vendorPrice: Number(linked?.vendor_price ?? 0),
          isAvailable: linked?.is_available ?? false,
          isFlashSale: linked?.is_flash_sale ?? false,
          flashSalePrice: linked?.flash_sale_price != null ? Number(linked.flash_sale_price) : null,
          flashSaleEndTime: linked?.flash_sale_end_time ?? null,
        };
      }),
    };
  } catch (error) {
    console.error("getVendorInventoryData failed:", error);
    throw new Error("Failed to load vendor inventory.");
  }
});

export const upsertVendorInventoryItem = createServerFn({ method: "POST" })
  .inputValidator((input) => upsertVendorProductInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: vendor, error: vendorError } = await getCurrentVendorQuery();

      if (vendorError || !vendor?.id) {
        throw new Error("No active vendor available.");
      }

      const { error } = await (supabaseAdmin as any).from("vendor_products").upsert(
        {
          vendor_id: (vendor as VendorRow).id,
          master_product_id: data.masterProductId,
          vendor_price: data.vendorPrice,
          is_available: data.isAvailable,
        },
        {
          onConflict: "vendor_id,master_product_id",
        },
      );

      if (error) {
        throw new Error(error.message);
      }

      return { ok: true };
    } catch (error) {
      console.error("upsertVendorInventoryItem failed:", error);
      throw new Error("Failed to save vendor inventory item.");
    }
  });

export const updateVendorFlashSale = createServerFn({ method: "POST" })
  .inputValidator((input) => updateVendorFlashSaleInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { data: vendor, error: vendorError } = await getCurrentVendorQuery();

      if (vendorError || !vendor?.id) {
        throw new Error("No active vendor available.");
      }

      if (data.enabled) {
        if (data.flashSalePrice == null || data.flashSaleEndTime == null) {
          throw new Error("Flash sale price and end time are required when enabling a flash sale.");
        }

        const endTime = new Date(data.flashSaleEndTime);
        if (Number.isNaN(endTime.getTime()) || endTime.getTime() <= Date.now()) {
          throw new Error("Flash sale end time must be in the future.");
        }
      }

      const updatePayload = data.enabled
        ? {
            is_flash_sale: true,
            flash_sale_price: data.flashSalePrice,
            flash_sale_end_time: data.flashSaleEndTime,
          }
        : {
            is_flash_sale: false,
            flash_sale_price: null,
            flash_sale_end_time: null,
          };

      const { error } = await (supabaseAdmin as any)
        .from("vendor_products")
        .update(updatePayload)
        .eq("vendor_id", (vendor as VendorRow).id)
        .eq("master_product_id", data.masterProductId);

      if (error) {
        throw new Error(error.message);
      }

      return { ok: true };
    } catch (error) {
      console.error("updateVendorFlashSale failed:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to update flash sale.");
    }
  });

export const listActiveFlashDeals = createServerFn({ method: "POST" })
  .inputValidator((input) => activeFlashDealsInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const nowIso = new Date().toISOString();
      const { data: neighborhoodRow } = await (supabaseAdmin as any)
        .from("neighborhoods")
        .select("vendor_id")
        .eq("id", data.neighborhoodId)
        .maybeSingle();

      const vendorId = (neighborhoodRow as { vendor_id?: string | null } | null)?.vendor_id ?? null;
      if (!vendorId) {
        return [] as Array<{
          id: string;
          name: string;
          nameFr: string | null;
          nameAr: string | null;
          measurementUnit: MeasurementUnit;
          imageUrl: string | null;
          vendorPrice: number;
          flashSalePrice: number;
          flashSaleEndTime: string;
        }>;
      }

      const { data: rows, error } = await (supabaseAdmin as any)
        .from("vendor_products")
        .select(
          "vendor_price, flash_sale_price, flash_sale_end_time, master_products:master_product_id(id, product_name, name_fr, name_ar, measurement_unit, image_url, is_active)",
        )
        .eq("vendor_id", vendorId)
        .eq("is_available", true)
        .eq("is_flash_sale", true)
        .gt("flash_sale_end_time", nowIso)
        .eq("master_products.is_active", true)
        .order("flash_sale_end_time", { ascending: true })
        .limit(4);

      if (error) {
        throw new Error(error.message);
      }

      return ((rows ?? []) as Array<{
        vendor_price: number;
        flash_sale_price: number | null;
        flash_sale_end_time: string | null;
        master_products: {
          id: string;
          product_name: string;
          name_fr: string | null;
          name_ar: string | null;
          measurement_unit: "Kg" | "Liter" | "Piece" | "Pack";
          image_url: string | null;
          is_active: boolean;
        } | null;
      }>)
        .filter((row) => !!row.master_products && row.flash_sale_price != null && !!row.flash_sale_end_time)
        .map((row) => ({
          id: row.master_products!.id,
          name: row.master_products!.product_name,
          nameFr: row.master_products!.name_fr,
          nameAr: row.master_products!.name_ar,
          measurementUnit: row.master_products!.measurement_unit,
          imageUrl: row.master_products!.image_url,
          vendorPrice: Number(row.vendor_price ?? 0),
          flashSalePrice: Number(row.flash_sale_price!),
          flashSaleEndTime: row.flash_sale_end_time!,
        }));
    } catch (error) {
      console.error("listActiveFlashDeals failed:", error);
      throw new Error("Failed to load flash deals.");
    }
  });

export const getCustomerCatalogByNeighborhood = createServerFn({ method: "POST" })
  .inputValidator((input) => customerCatalogInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const nowIso = new Date().toISOString();
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
        .select("id, store_name")
        .eq("id", vendorId)
        .eq("is_active", true)
        .maybeSingle();

      if (vendorError || !vendor?.id) {
        return {
          vendor: null,
          items: [] as Array<{
            id: string;
            name: string;
            nameFr: string | null;
            nameAr: string | null;
            category: ProductCategory;
            measurementUnit: MeasurementUnit;
            imageUrl: string | null;
            popularityScore: number;
            vendorPrice: number;
            isAvailable: boolean;
          }>,
          hasMore: false,
        };
      }

      const from = (data.page - 1) * data.pageSize;
      const to = from + data.pageSize;

      const { data: rows, error: rowsError } = await (supabaseAdmin as any)
        .from("vendor_products")
        .select(
          "vendor_price, is_available, master_products:master_product_id(id, product_name, name_fr, name_ar, category_id, category, measurement_unit, image_url, popularity_score, is_active)",
        )
        .eq("vendor_id", vendor.id)
        .eq("is_available", true)
        .or(`is_flash_sale.is.false,is_flash_sale.is.null,and(is_flash_sale.eq.true,flash_sale_end_time.lte.${nowIso})`)
        .eq("master_products.is_active", true)
        .order("popularity_score", { foreignTable: "master_products", ascending: false })
        .order("created_at", { foreignTable: "master_products", ascending: false })
        .range(from, to);

      if (rowsError) {
        throw new Error(rowsError.message);
      }

      return {
        vendor: vendor as VendorRow,
        items: ((rows ?? []) as Array<{
          vendor_price: number;
          is_available: boolean;
          master_products: {
            id: string;
            product_name: string;
            name_fr: string | null;
            name_ar: string | null;
            category_id: string | null;
            category: ProductCategory;
            measurement_unit: MeasurementUnit;
            image_url: string | null;
            popularity_score: number;
            is_active: boolean;
          } | null;
        }>)
          .filter((row) => !!row.master_products)
          .slice(0, data.pageSize)
          .map((row) => ({
            id: row.master_products!.id,
            name: row.master_products!.product_name,
            nameFr: row.master_products!.name_fr,
            nameAr: row.master_products!.name_ar,
            categoryId: row.master_products!.category_id,
            category: row.master_products!.category,
            measurementUnit: row.master_products!.measurement_unit,
            imageUrl: row.master_products!.image_url,
            popularityScore: Number(row.master_products!.popularity_score ?? 0),
            vendorPrice: Number(row.vendor_price ?? 0),
            isAvailable: row.is_available,
          })),
        hasMore: (rows?.length ?? 0) > data.pageSize,
      };
    } catch (error) {
      console.error("getCustomerCatalogByNeighborhood failed:", error);
      throw new Error("Failed to load marketplace products.");
    }
  });

export const getCustomerProductDetail = createServerFn({ method: "POST" })
  .inputValidator((input) => customerProductDetailInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const vendorLookupQuery = (supabaseAdmin as any)
        .from("vendors")
        .select("id")
        .eq("is_active", true);

      if (data.neighborhoodId) {
        const { data: neighborhood } = await (supabaseAdmin as any)
          .from("neighborhoods")
          .select("vendor_id")
          .eq("id", data.neighborhoodId)
          .maybeSingle();

        const vendorId = (neighborhood as { vendor_id?: string | null } | null)?.vendor_id ?? null;
        if (vendorId) {
          vendorLookupQuery.eq("id", vendorId);
        } else {
          return null;
        }
      }

      vendorLookupQuery.limit(1);

      const { data: vendorRows } = await vendorLookupQuery;
      const vendorId = (vendorRows?.[0] as { id?: string } | undefined)?.id ?? null;

      const productQuery = (supabaseAdmin as any)
        .from("vendor_products")
        .select(
          "vendor_price, is_available, master_products:master_product_id(id, product_name, name_fr, name_ar, category_id, category, measurement_unit, image_url, popularity_score, is_active)",
        )
        .eq("master_product_id", data.productId)
        .eq("is_available", true)
        .eq("master_products.is_active", true)
        .limit(1)
        .maybeSingle();

      if (vendorId) {
        productQuery.eq("vendor_id", vendorId);
      }

      const { data: row, error } = await productQuery;

      if (error) {
        throw new Error(error.message);
      }

      if (!row?.master_products) {
        return null;
      }

      return {
        id: row.master_products.id,
        name: row.master_products.product_name,
        nameFr: row.master_products.name_fr,
        nameAr: row.master_products.name_ar,
        categoryId: row.master_products.category_id,
        category: row.master_products.category,
        measurementUnit: row.master_products.measurement_unit,
        imageUrl: row.master_products.image_url,
        popularityScore: Number(row.master_products.popularity_score ?? 0),
        vendorPrice: Number(row.vendor_price ?? 0),
        isAvailable: row.is_available,
      };
    } catch (error) {
      console.error("getCustomerProductDetail failed:", error);
      throw new Error("Failed to load product details.");
    }
  });

export type MeasurementUnit = z.infer<typeof measurementUnitSchema>;
export type ProductCategory = z.infer<typeof productCategorySchema>;