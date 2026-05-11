import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { MobileHeader } from "@/components/MobileHeader";
import { Button } from "@/components/ui/button";
import { listActiveFlashDeals } from "@/lib/catalog.functions";
import { useCustomerCartStore } from "@/lib/customer-cart-store";
import fallbackProductImage from "@/assets/product-vegetables.jpg";

const LOCATION_STORAGE_KEY = "bzaf_fresh_location";

type AppLanguage = "en" | "fr" | "ar";

type FlashDealProduct = {
  id: string;
  name: string;
  nameFr: string | null;
  nameAr: string | null;
  measurementUnit: "Kg" | "Liter" | "Piece" | "Pack" | "Gram" | "Bunch" | "Tray" | "Box";
  imageUrl: string | null;
  vendorPrice: number;
  flashSalePrice: number;
  flashSaleEndTime: string;
};

export const Route = createFileRoute("/customer/flash-deals")({
  component: FlashDealsPage,
});

function FlashDealsPage() {
  const { t, i18n } = useTranslation();
  const language = (i18n.resolvedLanguage || i18n.language || "en") as AppLanguage;
  const [neighborhoodId, setNeighborhoodId] = useState<string | null>(null);
  const fetchFlashDeals = useServerFn(listActiveFlashDeals);
  const addCartItem = useCustomerCartStore((state) => state.addItem);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { neighborhoodId?: string };
      setNeighborhoodId(parsed.neighborhoodId ?? null);
    } catch {
      setNeighborhoodId(null);
    }
  }, []);

  const flashDealsQuery = useQuery({
    queryKey: ["customer", "flash-deals-page", neighborhoodId],
    queryFn: () => fetchFlashDeals({ data: { neighborhoodId: neighborhoodId! } }),
    enabled: !!neighborhoodId,
    refetchInterval: 10_000,
  });

  const deals = useMemo(() => {
    const rows = (flashDealsQuery.data ?? []) as FlashDealProduct[];
    return rows.map((row) => ({
      ...row,
      localizedName:
        language === "ar"
          ? row.nameAr || row.name
          : language === "fr"
            ? row.nameFr || row.name
            : row.name,
      discountPercent:
        row.vendorPrice > 0 ? Math.max(0, Math.round(((row.vendorPrice - row.flashSalePrice) / row.vendorPrice) * 100)) : 0,
    }));
  }, [flashDealsQuery.data, language]);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl px-4 pb-8 pt-0 sm:px-6">
      <MobileHeader title={t("flashDeals.title")} fallbackTo="/customer" />

      {flashDealsQuery.isLoading ? (
        <section className="rounded-2xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
          {t("loading", { defaultValue: "Loading flash deals..." })}
        </section>
      ) : deals.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm font-medium text-foreground">{t("flashDeals.emptyTitle", { defaultValue: "No flash deals right now" })}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("flashDeals.emptyHint", { defaultValue: "Check back soon for limited-time discounts." })}
          </p>
        </section>
      ) : (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {deals.map((deal) => (
            <article key={deal.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <span className="ml-3 mt-3 inline-flex rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
                -{deal.discountPercent}%
              </span>
              <div className="aspect-square bg-muted/40 px-2 pb-2">
                <img
                  src={deal.imageUrl || fallbackProductImage}
                  alt={deal.localizedName}
                  className="h-full w-full object-contain object-center"
                  loading="lazy"
                />
              </div>

              <div className="space-y-1 px-3 pb-3">
                <h2 className="line-clamp-2 text-sm font-semibold text-foreground">{deal.localizedName}</h2>
                <p className="text-sm font-bold text-destructive">{deal.flashSalePrice} MAD</p>
                <p className="text-xs text-muted-foreground line-through">{deal.vendorPrice} MAD</p>
                <Button
                  variant="soft"
                  size="sm"
                  className="mt-1 w-full rounded-xl"
                  onClick={() => {
                    addCartItem({
                      id: deal.id,
                      name: deal.localizedName,
                      price: Number(deal.flashSalePrice ?? 0),
                      measurementUnit: deal.measurementUnit,
                      image: deal.imageUrl || fallbackProductImage,
                      alt: deal.localizedName,
                    });

                    toast.success(t("products.add"), {
                      description: deal.localizedName,
                      duration: 1200,
                    });
                  }}
                >
                  <Plus className="size-4" />
                  {t("products.add")}
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}