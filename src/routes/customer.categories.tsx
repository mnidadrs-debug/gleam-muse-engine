import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Search, Shapes } from "lucide-react";

import { MobileHeader } from "@/components/MobileHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { listActiveCategories } from "@/lib/categories.functions";
import { CategoryIcon } from "@/lib/lucide-category-icons";
import fallbackProductImage from "@/assets/product-vegetables.jpg";

const LOCATION_STORAGE_KEY = "bzaf_fresh_location";

type PersistedLocation = {
  neighborhoodId?: string;
};

type CategoryRow = {
  id: string;
  name_en: string;
  name_fr: string;
  name_ar: string;
  image_url: string | null;
  icon_name: string | null;
  accent_color: string;
  product_count: number;
};

export const Route = createFileRoute("/customer/categories")({
  component: CategoriesRouteShell,
  head: () => ({
    meta: [
      { title: "Categories — Bzaf Fresh" },
      { name: "description", content: "Browse all grocery categories and discover products by section." },
    ],
  }),
});

function CategoriesRouteShell() {
  const location = useLocation();

  if (location.pathname !== "/customer/categories") {
    return <Outlet />;
  }

  return <CategoriesPage />;
}

function CategoriesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const fetchCategories = useServerFn(listActiveCategories);
  const [neighborhoodId, setNeighborhoodId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const language = (i18n.resolvedLanguage || i18n.language || "en") as "en" | "fr" | "ar";

  useEffect(() => {
    const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as PersistedLocation;
      setNeighborhoodId(parsed.neighborhoodId ?? null);
    } catch {
      setNeighborhoodId(null);
    }
  }, []);

  const categoriesQuery = useQuery({
    queryKey: ["categories", "list", neighborhoodId],
    queryFn: () => fetchCategories({ data: { neighborhoodId } }),
    staleTime: 30_000,
    refetchInterval: 45_000,
  });

  const categories = (categoriesQuery.data ?? []) as CategoryRow[];

  const localizedName = (category: CategoryRow) => {
    if (language === "ar") return category.name_ar || category.name_en;
    if (language === "fr") return category.name_fr || category.name_en;
    return category.name_en;
  };

  const sortedCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...categories]
      .sort((a, b) => (a.product_count === 0 ? 1 : 0) - (b.product_count === 0 ? 1 : 0))
      .filter((category) => {
        if (!query) return true;
        return localizedName(category).toLowerCase().includes(query);
      });
  }, [categories, search, language]);

  const badgeToneByIndex = [
    "bg-accent text-accent-foreground",
    "bg-primary text-primary-foreground",
    "bg-success text-success-foreground",
    "bg-highlight text-highlight-foreground",
  ];

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-background px-4 pb-6 pt-0">
      <MobileHeader
        title={t("categories.title", { defaultValue: "Quick categories" })}
        fallbackTo="/customer"
        rightSlot={
          <div className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
            <Shapes className="size-5" />
          </div>
        }
      />

      <p className="mb-3 text-center text-xs text-muted-foreground">
        {t("categories.subtitleDefault", { defaultValue: "Essentials first" })}
      </p>

      <div className="mb-5 flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-[var(--shadow-soft)]">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          type="search"
          placeholder={t("categoryPage.searchPlaceholder", { defaultValue: "Search products in this category" })}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">{sortedCategories.length}</h2>
        <span className="text-sm font-semibold text-foreground">{t("categories.title", { defaultValue: "Quick categories" })}</span>
      </header>

      {categoriesQuery.isLoading ? (
        <section className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="space-y-2 rounded-2xl border border-border bg-card p-2">
              <Skeleton className="aspect-[4/3] w-full rounded-xl" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </section>
      ) : categoriesQuery.isError ? (
        <section className="rounded-2xl border border-destructive/30 bg-card p-4 text-center">
          <p className="text-sm text-destructive">Failed to load categories.</p>
          <button
            type="button"
            onClick={() => categoriesQuery.refetch()}
            className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            Retry
          </button>
        </section>
      ) : sortedCategories.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">{t("categories.noCategories", { defaultValue: "No categories available in your area yet." })}</p>
        </section>
      ) : (
        <section className="grid grid-cols-2 gap-3">
          {sortedCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                navigate({
                  to: "/customer/categories/$id",
                  params: { id: category.id },
                });
              }}
              className="group rounded-2xl border border-border bg-card p-2 text-start shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5"
            >
              <div className="relative flex aspect-[4/3] items-center justify-center rounded-xl bg-muted/30">
                <span
                  className="flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: category.accent_color || "var(--color-muted)" }}
                >
                  {category.image_url ? (
                    <img
                      src={category.image_url || fallbackProductImage}
                      alt={localizedName(category)}
                      className="h-10 w-10 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <CategoryIcon iconName={category.icon_name} className="h-10 w-10 text-foreground" />
                  )}
                </span>
                <span
                  className={`absolute bottom-2 ${language === "ar" ? "left-2" : "right-2"} inline-flex size-8 items-center justify-center rounded-full text-xs font-semibold ${badgeToneByIndex[Number(category.id.at(-1) || 0) % badgeToneByIndex.length]}`}
                >
                  {Math.max(1, (category.product_count % 9) + 1)}
                </span>
              </div>
              <div className="px-1 pb-1 pt-2">
                <p className="line-clamp-1 text-sm font-semibold text-foreground">{localizedName(category)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("categories.productsCount", { count: category.product_count })}</p>
              </div>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
