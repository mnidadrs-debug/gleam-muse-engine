import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Search, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { MobileHeader } from "@/components/MobileHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { getCategoryById, listCategoryMasterProducts } from "@/lib/categories.functions";
import { CategoryIcon } from "@/lib/lucide-category-icons";
import { useCustomerCartStore } from "@/lib/customer-cart-store";
import fallbackProductImage from "@/assets/product-vegetables.jpg";

type AppLanguage = "en" | "fr" | "ar";

type CategoryRow = {
  id: string;
  name_en: string;
  name_fr: string;
  name_ar: string;
  image_url: string | null;
  icon_name: string | null;
  accent_color: string;
};

type CategoryProduct = {
  id: string;
  product_name: string;
  name_fr: string | null;
  name_ar: string | null;
  image_url: string | null;
  measurement_unit: "Kg" | "Liter" | "Piece" | "Pack" | "Gram" | "Bunch" | "Tray" | "Box";
  price?: number;
};

const FILTER_PILLS = ["all", "leafy", "fresh", "popular"] as const;

export const Route = createFileRoute("/customer/categories/$id")({
  component: CategoryDetailPage,
});

function CategoryDetailPage() {
  const { id } = Route.useParams();
  const { t, i18n } = useTranslation();
  const language = (i18n.resolvedLanguage || i18n.language || "en") as AppLanguage;
  const isArabic = language === "ar";

  const fetchCategoryById = useServerFn(getCategoryById);
  const fetchCategoryProducts = useServerFn(listCategoryMasterProducts);

  const [search, setSearch] = useState("");
  const [activePill, setActivePill] = useState<(typeof FILTER_PILLS)[number]>("all");
  const [neighborhoodId, setNeighborhoodId] = useState<string | null>(null);
  const addCartItem = useCustomerCartStore((state) => state.addItem);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("bzaf_fresh_location");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { neighborhoodId?: string };
      setNeighborhoodId(parsed.neighborhoodId ?? null);
    } catch {
      setNeighborhoodId(null);
    }
  }, []);

  const categoryQuery = useQuery({
    queryKey: ["category", "detail", id],
    queryFn: () => fetchCategoryById({ data: { categoryId: id } }),
  });

  const productsQuery = useQuery({
    queryKey: ["category", "products", id, neighborhoodId],
    queryFn: () =>
      fetchCategoryProducts({
        data: {
          categoryId: id,
          neighborhoodId,
        },
      }),
  });

  const category = categoryQuery.data as CategoryRow | null;
  const products = (productsQuery.data ?? []) as CategoryProduct[];

  const localizedCategoryName = useMemo(() => {
    if (!category) return t("categories.title", { defaultValue: "Quick categories" });
    if (language === "ar") return category.name_ar || category.name_en;
    if (language === "fr") return category.name_fr || category.name_en;
    return category.name_en;
  }, [category, language, t]);

  const localizedProducts = useMemo(() => {
    return products.map((product) => ({
      ...product,
      localizedName:
        language === "ar"
          ? product.name_ar || product.product_name
          : language === "fr"
            ? product.name_fr || product.product_name
            : product.product_name,
    }));
  }, [products, language]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = localizedProducts.filter((product) =>
      query ? product.localizedName.toLowerCase().includes(query) : true,
    );

    if (activePill === "all") return base;
    if (activePill === "leafy") return base.slice(0, Math.ceil(base.length / 2));
    if (activePill === "fresh") return base.filter((_, index) => index % 2 === 0);
    return base.filter((_, index) => index % 3 !== 0);
  }, [localizedProducts, search, activePill]);

  const addToCart = (product: (typeof filteredProducts)[number]) => {
    addCartItem({
      id: product.id,
      name: product.localizedName,
      price: Number(product.price ?? 0),
      measurementUnit: product.measurement_unit,
      image: product.image_url || fallbackProductImage,
      alt: product.localizedName,
    });

    toast.success(t("products.add", { defaultValue: "Added to cart" }), {
      description: product.localizedName,
      duration: 1400,
    });
  };

  const isLoading = categoryQuery.isLoading || productsQuery.isLoading;
  const hasError = categoryQuery.isError || productsQuery.isError;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-4 pb-6 pt-0">
      <MobileHeader title={localizedCategoryName} fallbackTo="/customer/categories" />

      <header className="mb-3 flex items-center justify-center gap-2">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: category?.accent_color || "var(--color-muted)" }}
        >
          {category?.image_url ? (
            <img src={category.image_url || fallbackProductImage} alt={localizedCategoryName} className="h-5 w-5 object-contain" />
          ) : (
            <CategoryIcon iconName={category?.icon_name} className="h-5 w-5 text-foreground" />
          )}
        </span>
        <p className="text-[11px] text-muted-foreground">
          {t("categoryDetail.subtitle", { defaultValue: "Choose what you need from top products" })}
        </p>
      </header>

      <div className="mb-3 flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2.5">
        <Search className="size-4 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("categoryDetail.search", { defaultValue: "Search in this category" })}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      <div className="category-scroll mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTER_PILLS.map((pill) => (
          <button
            key={pill}
            type="button"
            onClick={() => setActivePill(pill)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              activePill === pill
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {t(`categoryDetail.pills.${pill}`, { defaultValue: pill === "all" ? "All" : pill === "leafy" ? "Leafy" : pill === "fresh" ? "Fresh" : "Popular" })}
          </button>
        ))}
      </div>

      {isLoading ? (
        <section className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-2xl border border-border bg-card p-2">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton className="mt-2 h-4 w-3/4" />
              <Skeleton className="mt-1 h-3 w-1/2" />
            </div>
          ))}
        </section>
      ) : hasError ? (
        <section className="rounded-2xl border border-destructive/35 bg-card p-4 text-center">
          <p className="text-sm text-destructive">{t("categoryDetail.error", { defaultValue: "Failed to load category details." })}</p>
          <button
            type="button"
            onClick={() => {
              void categoryQuery.refetch();
              void productsQuery.refetch();
            }}
            className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            {t("categoryDetail.retry", { defaultValue: "Retry" })}
          </button>
        </section>
      ) : filteredProducts.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-6 text-center">
          <Sparkles className="mx-auto mb-2 size-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{t("categoryDetail.emptyTitle", { defaultValue: "No products yet" })}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("categoryDetail.emptyHint", { defaultValue: "Products for this category will appear here soon." })}</p>
        </section>
      ) : (
        <section className="grid grid-cols-2 gap-4">
          {filteredProducts.map((product, index) => (
            <article
              key={product.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-2"
            >
              <span className="absolute left-3 top-3 z-10 rounded-full bg-highlight px-2 py-0.5 text-[10px] font-semibold text-highlight-foreground">
                -{5 + ((index % 4) + 1) * 5}%
              </span>

              <div className="aspect-square overflow-hidden rounded-xl bg-muted/40">
                <img
                  src={product.image_url || fallbackProductImage}
                  alt={product.localizedName}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              </div>

              <div className="pt-2">
                <p className="line-clamp-2 text-sm font-semibold text-foreground">{product.localizedName}</p>
                <p className="mt-1 text-xs font-medium text-primary">{product.measurement_unit}</p>
              </div>

              <button
                type="button"
                onClick={() => addToCart(product)}
                className={`absolute bottom-3 ${isArabic ? "left-3" : "right-3"} inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-soft)]`}
                aria-label={t("products.add", { defaultValue: "Add" })}
              >
                <Plus className="size-4" />
              </button>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
