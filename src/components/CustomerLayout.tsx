import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import {
  House,
  Search,
  ShoppingCart,
  UserCircle2,
  Plus,
  Minus,
  Trash2,
  X,
  ClipboardList,
  User,
  Gift,
  BookOpen,
  ShoppingBag,
  BadgeCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState as AppEmptyState } from "@/components/ui/empty-state";
import { getGlobalSettings } from "@/lib/admin-dashboard.functions";
import { getCustomerCarnetBalance, getCustomerCarnetOverview } from "@/lib/carnet.functions";
import { useCustomerCartStore } from "@/lib/customer-cart-store";
import { listServiceZones } from "@/lib/locations.functions";
import { useCustomerPanelStore } from "@/lib/customer-panel-store";

const CUSTOMER_SESSION_STORAGE_KEY = "bzaf.customerSession";

type CustomerLayoutProps = {
  children: React.ReactNode;
  onSearchClick?: () => void;
  onCheckoutClick?: () => void;
};

export function CustomerLayout({
  children,
  onSearchClick,
  onCheckoutClick,
}: CustomerLayoutProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const fetchGlobalSettings = useServerFn(getGlobalSettings);
  const fetchCustomerCarnetBalance = useServerFn(getCustomerCarnetBalance);
  const fetchCustomerCarnetOverview = useServerFn(getCustomerCarnetOverview);
  const fetchServiceZones = useServerFn(listServiceZones);
  const cartItems = useCustomerCartStore((state) => state.items);
  const isCartOpen = useCustomerCartStore((state) => state.isCartOpen);
  const openCart = useCustomerCartStore((state) => state.openCart);
  const closeCart = useCustomerCartStore((state) => state.closeCart);
  const increaseItem = useCustomerCartStore((state) => state.increaseItem);
  const decreaseItem = useCustomerCartStore((state) => state.decreaseItem);
  const removeItem = useCustomerCartStore((state) => state.removeItem);
  const isCustomerAuthModalOpen = useCustomerPanelStore((state) => state.isCustomerAuthModalOpen);
  const customerPanelView = useCustomerPanelStore((state) => state.customerPanelView);
  const openCustomerPanel = useCustomerPanelStore((state) => state.openCustomerPanel);
  const [isProfileHubOpen, setIsProfileHubOpen] = useState(false);
  const [isCarnetDialogOpen, setIsCarnetDialogOpen] = useState(false);
  const profileHubTimerRef = useRef<number | null>(null);
  const [customerSessionPhone, setCustomerSessionPhone] = useState<string | null>(null);
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<string | null>(null);

  const globalSettingsQuery = useQuery({
    queryKey: ["customer", "global-settings"],
    queryFn: () => fetchGlobalSettings(),
    staleTime: 30_000,
  });

  const serviceZonesQuery = useQuery({
    queryKey: ["customer", "service-zones"],
    queryFn: () => fetchServiceZones(),
    staleTime: 30_000,
  });

  const customerCarnetBalanceQuery = useQuery({
    queryKey: ["customer", "profile-hub", "carnet-balance", customerSessionPhone],
    queryFn: () =>
      fetchCustomerCarnetBalance({
        data: { customerPhone: customerSessionPhone! },
      }),
    enabled: !!customerSessionPhone,
    staleTime: 10_000,
    refetchInterval: customerSessionPhone ? 8_000 : false,
  });

  const customerCarnetOverviewQuery = useQuery({
    queryKey: ["customer", "profile-hub", "carnet-overview", customerSessionPhone],
    queryFn: () =>
      fetchCustomerCarnetOverview({
        data: { customerPhone: customerSessionPhone! },
      }),
    enabled: isCarnetDialogOpen && !!customerSessionPhone,
    staleTime: 10_000,
  });

  const cartCount = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems],
  );
  const cartTotal = useMemo(
    () => cartItems.reduce((total, item) => total + item.price * item.quantity, 0),
    [cartItems],
  );
  const cartLabel = useMemo(() => `${cartCount} item${cartCount === 1 ? "" : "s"}`, [cartCount]);
  const isArabic = (i18n.resolvedLanguage || i18n.language || "en") === "ar";

  const ledgerSections = useMemo(() => {
    const transactions = (customerCarnetOverviewQuery.data?.transactions ?? []) as Array<{
      id: string;
      createdAt: string;
      description: string;
      amount: number;
      kind: "debt" | "payment";
    }>;

    const dateFormatter = new Intl.DateTimeFormat(isArabic ? "ar-MA" : "fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const timeFormatter = new Intl.DateTimeFormat(isArabic ? "ar-MA" : "fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const groups = new Map<
      string,
      {
        label: string;
        rows: Array<{
          id: string;
          title: string;
          time: string;
          amount: number;
          kind: "debt" | "payment";
        }>;
      }
    >();

    for (const transaction of transactions) {
      const date = new Date(transaction.createdAt);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      if (!groups.has(dateKey)) {
        groups.set(dateKey, {
          label: dateFormatter.format(date),
          rows: [],
        });
      }

      groups.get(dateKey)?.rows.push({
        id: transaction.id,
        title: transaction.description,
        time: timeFormatter.format(date),
        amount: Number(transaction.amount ?? 0),
        kind: transaction.kind,
      });
    }

    return Array.from(groups.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([, value]) => value);
  }, [customerCarnetOverviewQuery.data?.transactions, isArabic]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("bzaf_fresh_location");
      if (!raw) {
        setSelectedNeighborhoodId(null);
        return;
      }

      const parsed = JSON.parse(raw) as { neighborhoodId?: string };
      setSelectedNeighborhoodId(typeof parsed?.neighborhoodId === "string" ? parsed.neighborhoodId : null);
    } catch {
      setSelectedNeighborhoodId(null);
    }
  }, [location.pathname, isCartOpen]);

  const selectedNeighborhoodFee = useMemo(() => {
    if (!selectedNeighborhoodId) return null;

    const zones = serviceZonesQuery.data ?? [];
    for (const commune of zones) {
      const neighborhood = commune.neighborhoods.find((item) => item.id === selectedNeighborhoodId);
      if (neighborhood) {
        return Number(neighborhood.deliveryFee ?? 0);
      }
    }

    return null;
  }, [selectedNeighborhoodId, serviceZonesQuery.data]);

  const globalDeliveryFee = Number(globalSettingsQuery.data?.global_delivery_fee ?? 10);
  const freeDeliveryThreshold = Number(globalSettingsQuery.data?.free_delivery_threshold ?? 500);
  const effectiveDeliveryFee = useMemo(() => {
    if (cartTotal >= freeDeliveryThreshold) {
      return 0;
    }

    if (selectedNeighborhoodFee !== null) {
      return selectedNeighborhoodFee;
    }

    return globalDeliveryFee;
  }, [cartTotal, freeDeliveryThreshold, selectedNeighborhoodFee, globalDeliveryFee]);
  const totalWithDelivery = cartTotal + effectiveDeliveryFee;
  const amountToFreeDelivery = Math.max(freeDeliveryThreshold - cartTotal, 0);

  const handleCheckout = () => {
    if (onCheckoutClick) {
      onCheckoutClick();
      return;
    }

    closeCart();
    void navigate({ to: "/", hash: "checkout" });
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOMER_SESSION_STORAGE_KEY);
      if (!raw) {
        setCustomerSessionPhone(null);
        return;
      }

      const parsed = JSON.parse(raw) as { phoneNumber?: string };
      setCustomerSessionPhone(typeof parsed?.phoneNumber === "string" ? parsed.phoneNumber : null);
    } catch {
      setCustomerSessionPhone(null);
    }
  }, [location.pathname, isCustomerAuthModalOpen]);

  useEffect(() => {
    return () => {
      if (profileHubTimerRef.current) {
        window.clearTimeout(profileHubTimerRef.current);
      }
    };
  }, []);

  const openProfilePanelFromHub = (view: "orders" | "account" | "carnet") => {
    setIsProfileHubOpen(false);
    if (profileHubTimerRef.current) {
      window.clearTimeout(profileHubTimerRef.current);
    }
    profileHubTimerRef.current = window.setTimeout(() => {
      openCustomerPanel(view);
      void navigate({ to: "/customer" });
    }, 140);
  };

  return (
    <>
      <main className="pb-24 md:pb-0">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background pb-safe shadow-[var(--shadow-soft)] md:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-start justify-around px-4 pt-2">
          <Link to="/" className="flex flex-col items-center justify-center gap-1 text-primary">
            <House className="size-5" />
            <span className="text-[10px] font-medium">{t("nav.home")}</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              if (onSearchClick) {
                onSearchClick();
              } else {
                void navigate({ to: "/customer/categories" });
              }
            }}
            className="flex flex-col items-center justify-center gap-1 text-muted-foreground"
          >
            <Search className="size-5" />
            <span className="text-[10px]">{t("nav.search")}</span>
          </button>

          <button
            type="button"
            onClick={openCart}
            className="relative flex flex-col items-center justify-center gap-1 text-muted-foreground"
            aria-label={cartLabel}
          >
            <span className="relative">
              <ShoppingCart className="size-5" />
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
                {cartCount}
              </span>
            </span>
            <span className="text-[10px]">{t("nav.cart")}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsProfileHubOpen(true);
            }}
            className={`flex flex-col items-center justify-center gap-1 ${
              isProfileHubOpen ||
              isCustomerAuthModalOpen ||
              customerPanelView === "profile" ||
              location.pathname === "/profile"
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          >
            <UserCircle2 className="size-5" />
            <span className="text-[10px]">{t("nav.profile")}</span>
          </button>
        </div>
      </nav>

      {isProfileHubOpen ? (
        <div className="fixed inset-0 z-[110] md:hidden">
          <button
            type="button"
            aria-label="Close profile menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsProfileHubOpen(false)}
          />
          <section className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-border bg-background p-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
            <h2 className="text-sm font-semibold text-foreground">Profile Hub</h2>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => openProfilePanelFromHub("orders")}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left transition hover:bg-muted"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ClipboardList className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">My Orders · طلباتي</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => openProfilePanelFromHub("account")}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left transition hover:bg-muted"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <User className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">Account Settings · إعدادات الحساب</span>
                </span>
              </button>

              {customerCarnetBalanceQuery.isLoading && customerSessionPhone ? (
                <div className="h-[78px] w-full animate-pulse rounded-xl border border-border bg-card" />
              ) : null}

              {customerCarnetBalanceQuery.data?.hasCarnet ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileHubOpen(false);
                    setIsCarnetDialogOpen(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left transition hover:bg-muted"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BookOpen className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1 flex-col">
                    <span className="block text-sm font-semibold text-foreground">My Carnet · الكارني ديالي</span>
                    <div className="text-red-500 font-semibold text-sm mt-1">
                      Debt: {Number(customerCarnetBalanceQuery.data?.totalDebtMad ?? 0).toFixed(2)} MAD
                    </div>
                  </span>
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {isCartOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-background shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="flex items-start justify-between border-b border-border p-5">
              <div>
                <h2 className="text-left text-xl font-semibold text-foreground">Your Cart</h2>
                <p className="text-left text-sm text-muted-foreground">{cartLabel} in your basket</p>
              </div>
              <button
                aria-label="Close cart drawer"
                onClick={closeCart}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>

            {cartItems.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <ShoppingCart className="size-6" />
                </div>
                <p className="mt-5 text-lg font-semibold text-foreground">Your cart is empty</p>
                <p className="mt-2 text-sm text-muted-foreground">Let&apos;s get some fresh groceries!</p>
                <Button variant="hero" className="mt-6 rounded-xl" onClick={closeCart}>
                  Continue Shopping
                </Button>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {cartItems.map((item) => (
                    <article
                      key={item.id}
                      className="surface-panel flex items-center gap-3 rounded-xl border border-border p-3"
                    >
                      <img
                        src={item.image}
                        alt={item.alt}
                        className="h-14 w-14 rounded-lg bg-muted/40 object-contain object-center p-1"
                        width={112}
                        height={112}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                        <p className="text-sm font-medium text-primary">{item.price} MAD</p>
                        <div className="mt-2 inline-flex items-center gap-2">
                          <button
                            aria-label={`Decrease quantity of ${item.name}`}
                            onClick={() => decreaseItem(item.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-foreground transition hover:bg-muted"
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="min-w-5 text-center text-sm font-semibold">{item.quantity}</span>
                          <button
                            aria-label={`Increase quantity of ${item.name}`}
                            onClick={() => increaseItem(item.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-foreground transition hover:bg-muted"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      </div>
                      <button
                        aria-label={`Remove ${item.name}`}
                        onClick={() => removeItem(item.id)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </article>
                  ))}
                </div>

                <div className="border-t border-border p-5">
                  <div className="mb-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Subtotal</p>
                      <p className="text-sm font-semibold text-foreground">{cartTotal.toFixed(2)} MAD</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Delivery</p>
                      <p className="text-sm font-semibold text-foreground">{effectiveDeliveryFee.toFixed(2)} MAD</p>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-sm font-medium text-muted-foreground">Total Price</p>
                      <p className="text-xl font-semibold text-foreground">{totalWithDelivery.toFixed(2)} MAD</p>
                    </div>
                  </div>

                  {cartItems.length > 0 ? (
                    <div className="mb-4 rounded-xl border border-success/30 bg-success/10 px-3 py-2">
                      <p className="inline-flex items-center gap-2 text-xs font-semibold text-success">
                        <Gift className="size-3.5" />
                        {amountToFreeDelivery > 0
                          ? isArabic
                            ? `زيد ${amountToFreeDelivery.toFixed(2)} درهم باش تستافد من توصيل فابور!`
                            : `Spend ${amountToFreeDelivery.toFixed(2)} MAD more to get FREE Delivery!`
                          : isArabic
                            ? "مبروك! عندك توصيل فابور"
                            : "You have unlocked Free Delivery! 🎉"}
                      </p>
                    </div>
                  ) : null}

                  <div className="mb-4" />
                  <div>
                    <Button variant="hero" size="lg" className="w-full rounded-xl" onClick={handleCheckout}>
                      Proceed to Checkout
                    </Button>
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      ) : null}

      <Dialog open={isCarnetDialogOpen} onOpenChange={setIsCarnetDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl border-border bg-background/95 p-0 backdrop-blur-sm">
          <DialogHeader className="border-b border-border px-5 pb-4 pt-5">
            <DialogTitle>Carnet Details · تفاصيل الكارني</DialogTitle>
            <DialogDescription className="mt-2 space-y-1 text-left">
              <p className="text-xs text-muted-foreground">Total Unpaid Balance · الرصيد المتبقي</p>
              <p className="text-2xl font-bold text-destructive">
                {Number(customerCarnetOverviewQuery.data?.carnet?.currentDebt ?? customerCarnetBalanceQuery.data?.totalDebtMad ?? 0).toFixed(2)}
                <span className="ml-1 text-base font-semibold">MAD</span>
              </p>
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[52vh] overflow-y-auto px-5 py-3">
            {customerCarnetOverviewQuery.isLoading ? (
              <div className="space-y-3 py-1">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`ledger-skeleton-${index}`} className="h-12 animate-pulse rounded-lg bg-muted/50" />
                ))}
              </div>
            ) : ledgerSections.length === 0 ? (
              <AppEmptyState
                title="No carnet transactions yet."
                subtitle="Your ledger activity will appear here once you place carnet orders or make payments."
                className="px-4 py-6"
              />
            ) : (
              <div className="space-y-4">
                {ledgerSections.map((section) => (
                  <section key={section.label}>
                    <div className="sticky top-0 z-10 border-b border-border bg-background/95 py-2 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
                      {section.label}
                    </div>
                    <div>
                      {section.rows.map((row) => (
                        <div key={row.id} className="flex items-center justify-between gap-3 border-b border-border py-3">
                          <div className="min-w-0 flex flex-1 items-center gap-3">
                            <span
                              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                                row.kind === "debt" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
                              }`}
                            >
                              {row.kind === "debt" ? <ShoppingBag className="size-4" /> : <BadgeCheck className="size-4" />}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">{row.title}</p>
                              <p className="text-xs text-muted-foreground">{row.time}</p>
                            </div>
                          </div>
                          <div
                            className={`shrink-0 text-right text-sm font-semibold ${
                              row.kind === "debt" ? "text-destructive" : "text-success"
                            }`}
                          >
                            {row.kind === "debt" ? "+" : "-"} {row.amount.toFixed(2)} MAD
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border bg-background/95 px-5 py-4">
            <Button className="w-full" onClick={() => setIsCarnetDialogOpen(false)}>
              Understood / Close · حسناً / إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
