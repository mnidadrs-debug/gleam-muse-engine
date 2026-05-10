import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { MobileHeader } from "@/components/MobileHeader";
import { getCustomerProductDetail } from "@/lib/catalog.functions";
import { useCustomerCartStore } from "@/lib/customer-cart-store";
import fallbackProductImage from "@/assets/product-vegetables.jpg";

const LOCATION_STORAGE_KEY = "bzaf_fresh_location";

type AppLanguage = "en" | "fr" | "ar";

export const Route = createFileRoute("/customer/product/$id")({
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { id } = Route.useParams();
  const { t, i18n } = useTranslation();
  const language = (i18n.resolvedLanguage || i18n.language || "en") as AppLanguage;
  const [neighborhoodId, setNeighborhoodId] = useState<string | null>(null);
  const fetchProductDetail = useServerFn(getCustomerProductDetail);
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

  const productQuery = useQuery({
    queryKey: ["product-detail", id, neighborhoodId],
    queryFn: () =>
      fetchProductDetail({
        data: {
          productId: id,
          neighborhoodId,
        },
      }),
  });

  const product = productQuery.data;

  const localizedName = useMemo(() => {
    if (!product) return "";
    if (language === "ar") return product.nameAr || product.name;
    if (language === "fr") return product.nameFr || product.name;
    return product.name;
  }, [product, language]);

  const addToCart = () => {
    if (!product) return;

    addCartItem({
      id: product.id,
      name: localizedName,
      price: Number(product.vendorPrice ?? 0),
      measurementUnit: product.measurementUnit,
      image: product.imageUrl || fallbackProductImage,
      alt: localizedName,
    });

    toast.success(t("products.add"), {
      description: localizedName,
      duration: 1200,
    });
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-4 pb-28 pt-0 sm:px-6">
      <MobileHeader title={localizedName || t("allProducts.title")} fallbackTo="/customer/all-products" />

      {!product ? (
        <section className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">{t("productDetail.notFound")}</p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="aspect-square bg-muted/40">
            <img
              src={product.imageUrl || fallbackProductImage}
              alt={localizedName}
              className="h-full w-full object-contain object-center p-4"
              loading="lazy"
            />
          </div>
          <div className="space-y-2 p-4">
            <h2 className="text-xl font-semibold text-foreground">{localizedName}</h2>
            <p className="text-lg font-semibold text-primary">
              {Number(product.vendorPrice ?? 0)} MAD / {product.measurementUnit}
            </p>
          </div>
        </section>
      )}

      {product ? (
        <div className="fixed inset-x-0 bottom-20 z-40 mx-auto w-full max-w-3xl px-4 sm:px-6 md:bottom-6">
          <Button variant="hero" size="lg" className="w-full rounded-xl" onClick={addToCart}>
            <Plus className="size-5" />
            {t("productDetail.addToCart")}
          </Button>
        </div>
      ) : null}
    </main>
  );
}