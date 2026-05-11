import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import {
  Bike,
  Search,
  ShoppingCart,
  UserCircle2,
  Plus,
  X,
  MapPin,
  HandCoins,
  CreditCard,
  CheckCircle2,
  House,
  Gift,
  Sparkles,
  ShieldCheck,
  MessageCircle,
  ChevronDown,
  ClipboardList,
  BookOpen,
  Globe,
  Share2,
  Flame,
  Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  formatMoroccoPhoneForPayload,
  isValidMoroccoPhone,
  normalizeMoroccoPhoneInput,
} from "@/lib/morocco-phone";
import { getCustomerCatalogByNeighborhood, listActiveFlashDeals } from "@/lib/catalog.functions";
import type { ProductCategory } from "@/lib/catalog.functions";
import { listActiveCategories } from "@/lib/categories.functions";
import {
  createOtpRequest,
  getCustomerProfileByPhone,
  upsertCustomerNeighborhood,
  verifyOtpCode,
} from "@/lib/customers.functions";
import { getCheckoutPaymentOptions, getCustomerCarnetOverview } from "@/lib/carnet.functions";
import { getGlobalSettings } from "@/lib/admin-dashboard.functions";
import { getActiveAdsAndAnnouncements } from "@/lib/ads-content.functions";
import { listServiceZones } from "@/lib/locations.functions";
import { createCustomerOrder, getCustomerOrders, upsertCustomerProfile } from "@/lib/orders.functions";
import { playSuccessSound } from "@/lib/sound-alerts";
import { CategoryIcon } from "@/lib/lucide-category-icons";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/morocco-cyclist-hero.jpg";
import fallbackProductImage from "@/assets/product-vegetables.jpg";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { Progress } from "@/components/ui/progress";
import { EmptyState as AppEmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import productDairyImage from "@/assets/product-dairy.jpg";
import productKhobzImage from "@/assets/product-khobz.jpg";
import productMintTeaImage from "@/assets/product-mint-tea.jpg";
import { useCustomerCartStore } from "@/lib/customer-cart-store";
import { type CustomerPanelView, useCustomerPanelStore } from "@/lib/customer-panel-store";

export const Route = createFileRoute("/customer/")({
  head: () => ({
    meta: [
      { title: "Bzaf Fresh — Grocery Delivery Morocco" },
      {
        name: "description",
        content:
          "Fast, eco-friendly daily grocery delivery across Morocco with bicycle couriers and fresh essentials in minutes.",
      },
      { property: "og:title", content: "Bzaf Fresh — Grocery Delivery Morocco" },
      {
        property: "og:description",
        content:
          "Order Moroccan essentials with zero-emission bicycle delivery, curated categories, and fresh products every day.",
      },
      { name: "twitter:title", content: "Bzaf Fresh — Grocery Delivery Morocco" },
      {
        name: "twitter:description",
        content: "Moroccan daily essentials delivered by bicycle with zero emissions.",
      },
    ],
    links: [{ rel: "canonical", href: "https://id-preview--d3fabfd6-6e10-4019-b625-dad909d25879.lovable.app/" }],
  }),
  component: Index,
});

type Product = {
  id: string;
  name: string;
  nameFr?: string | null;
  nameAr?: string | null;
  category: ProductCategory;
  categoryId?: string | null;
  price: number;
  measurementUnit: "Kg" | "Liter" | "Piece" | "Pack";
  image: string;
  alt: string;
};

const productFallbackImage = heroImage;

type AdSlide = {
  id: string;
  image: string;
  linkUrl: string | null;
  alt: string;
  headline: string;
  copy: string;
  tag: "Featured" | "AD";
};

type AnnouncementRow = {
  id: string;
  content: string;
  content_fr: string | null;
  content_ar: string | null;
  bg_color: string;
  text_color: string;
};

type SiteAdRow = {
  id: string;
  image_url: string;
  link_url: string | null;
  sort_order: number;
};

const adSlides: AdSlide[] = [
  {
    id: "hero",
    image: heroImage,
    linkUrl: null,
    alt: "Bicycle courier delivering groceries in Morocco",
    headline: "Daily groceries delivered in minutes",
    copy: "Fast local essentials with clean bicycle delivery across Morocco.",
    tag: "Featured",
  },
  {
    id: "mint-tea-ad",
    image: productMintTeaImage,
    linkUrl: null,
    alt: "Promotional poster for Moroccan mint tea offer",
    headline: "Mint Tea Week Offer",
    copy: "Buy 2 packs and get 15% off this week only.",
    tag: "AD",
  },
  {
    id: "bakery-ad",
    image: productKhobzImage,
    linkUrl: null,
    alt: "Promotional poster for fresh bakery essentials",
    headline: "Fresh Bakery Every Morning",
    copy: "Priority delivery slots for breakfast essentials.",
    tag: "AD",
  },
  {
    id: "dairy-ad",
    image: productDairyImage,
    linkUrl: null,
    alt: "Promotional poster for dairy bundle offer",
    headline: "Family Dairy Bundle",
    copy: "Save more on milk, yogurt, and cheese bundles.",
    tag: "AD",
  },
];

type CategoryChip = {
  id: string;
  name_en: string;
  name_fr: string;
  name_ar: string;
  image_url: string | null;
  icon_name: string | null;
  accent_color: string;
  sort_order: number;
  product_count: number;
};

type CartItem = Product & {
  quantity: number;
};

type CheckoutStep = "details" | "success";
const LOCATION_STORAGE_KEY = "bzaf_fresh_location";
const CUSTOMER_SESSION_STORAGE_KEY = "bzaf.customerSession";
const OTP_WEBHOOK_URL = "https://n8n.srv961724.hstgr.cloud/webhook/otpwtss";

type PersistedLocation = {
  communeId: string;
  neighborhoodId: string;
  locationLabel: string;
};

type CustomerAuthStep = "phone" | "otp";

type CustomerSession = {
  phoneNumber: string;
};

type AppLanguage = "en" | "fr" | "ar";

const languageOptions: Array<{ code: AppLanguage; label: string }> = [
  { code: "ar", label: "🇲🇦 العربية" },
  { code: "fr", label: "🇫🇷 Français" },
  { code: "en", label: "🇬🇧 English" },
];

function useCustomerCarnet(
  customerPhone: string | null,
  fetchCustomerCarnetOverview: (input: { data: { customerPhone: string } }) => Promise<any>,
) {
  return useQuery({
    queryKey: ["customer", "carnet", customerPhone],
    queryFn: () =>
      fetchCustomerCarnetOverview({
        data: {
          customerPhone: customerPhone!,
        },
      }),
    enabled: !!customerPhone,
    refetchInterval: customerPhone ? 8_000 : false,
  });
}

function Index() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate({ from: "/customer/" });
  const location = useLocation();
  const queryClient = useQueryClient();
  const cartItems = useCustomerCartStore((state) => state.items);
  const addCartItem = useCustomerCartStore((state) => state.addItem);
  const clearCart = useCustomerCartStore((state) => state.clearCart);
  const openCart = useCustomerCartStore((state) => state.openCart);
  const closeCart = useCustomerCartStore((state) => state.closeCart);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const isCustomerAuthModalOpen = useCustomerPanelStore((state) => state.isCustomerAuthModalOpen);
  const setIsCustomerAuthModalOpen = useCustomerPanelStore((state) => state.setIsCustomerAuthModalOpen);
  const customerPanelView = useCustomerPanelStore((state) => state.customerPanelView);
  const setCustomerPanelView = useCustomerPanelStore((state) => state.setCustomerPanelView);
  const openCustomerPanel = useCustomerPanelStore((state) => state.openCustomerPanel);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("details");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"COD" | "Carnet">("COD");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [authStep, setAuthStep] = useState<CustomerAuthStep>("phone");
  const [authPhoneInput, setAuthPhoneInput] = useState("");
  const [authPhoneForOtp, setAuthPhoneForOtp] = useState("");
  const [authOtpCode, setAuthOtpCode] = useState("");
  const [isSendingAuthCode, setIsSendingAuthCode] = useState(false);
  const [isVerifyingAuthOtp, setIsVerifyingAuthOtp] = useState(false);
  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  const locationSyncRef = useRef<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [hasHydratedCheckoutProfile, setHasHydratedCheckoutProfile] = useState(false);
  const [selectedCommuneId, setSelectedCommuneId] = useState("");
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState("");
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [flashNowMs, setFlashNowMs] = useState(0);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const language = (i18n.resolvedLanguage || i18n.language || "en") as AppLanguage;
  const isArabic = language === "ar";
  const [isCategoryTickerPaused, setIsCategoryTickerPaused] = useState(false);
  const [isBottomPromoDismissed, setIsBottomPromoDismissed] = useState(false);
  const flashDealsAutoplayRef = useRef(
    Autoplay({ delay: 3200, stopOnMouseEnter: true, stopOnFocusIn: true, stopOnInteraction: false }),
  );
  const bottomPromoAutoplayRef = useRef(
    Autoplay({ delay: 4500, stopOnMouseEnter: true, stopOnFocusIn: true, stopOnInteraction: false }),
  );

  const changeLanguage = (nextLanguage: AppLanguage) => {
    void i18n.changeLanguage(nextLanguage);
  };

  const getLocalizedText = ({
    en,
    fr,
    ar,
  }: {
    en: string;
    fr?: string | null;
    ar?: string | null;
  }) => {
    if (language === "ar") return ar?.trim() || en;
    if (language === "fr") return fr?.trim() || en;
    return en;
  };
  const submitOrder = useServerFn(createCustomerOrder);
  const fetchCustomerOrders = useServerFn(getCustomerOrders);
  const saveCustomerProfile = useServerFn(upsertCustomerProfile);
  const fetchServiceZones = useServerFn(listServiceZones);
  const fetchCatalogByNeighborhood = useServerFn(getCustomerCatalogByNeighborhood);
  const fetchCustomerProfileByPhone = useServerFn(getCustomerProfileByPhone);
  const syncCustomerNeighborhood = useServerFn(upsertCustomerNeighborhood);
  const createOtpRequestFn = useServerFn(createOtpRequest);
  const verifyOtpCodeFn = useServerFn(verifyOtpCode);
  const fetchCheckoutPaymentOptions = useServerFn(getCheckoutPaymentOptions);
  const fetchCustomerCarnetOverview = useServerFn(getCustomerCarnetOverview);
  const fetchGlobalSettings = useServerFn(getGlobalSettings);
  const fetchActiveAdsAndAnnouncements = useServerFn(getActiveAdsAndAnnouncements);
  const fetchActiveCategories = useServerFn(listActiveCategories);
  const fetchActiveFlashDeals = useServerFn(listActiveFlashDeals);
  const serviceZonesQuery = useQuery({
    queryKey: ["customer", "service-zones"],
    queryFn: () => fetchServiceZones(),
  });
  const globalSettingsQuery = useQuery({
    queryKey: ["customer", "global-settings"],
    queryFn: () => fetchGlobalSettings(),
    staleTime: 30_000,
  });
  const catalogQuery = useInfiniteQuery({
    queryKey: ["customer", "catalog", selectedNeighborhoodId],
    queryFn: ({ pageParam }) =>
      fetchCatalogByNeighborhood({
        data: {
          neighborhoodId: selectedNeighborhoodId,
          page: Number(pageParam),
          pageSize: 12,
        },
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage?.hasMore ? allPages.length + 1 : undefined),
    enabled: !!selectedNeighborhoodId,
    refetchInterval: selectedNeighborhoodId ? 12_000 : false,
  });
  const customerProfileQuery = useQuery({
    queryKey: ["customer", "profile", customerSession?.phoneNumber ?? null],
    queryFn: () =>
      fetchCustomerProfileByPhone({
        data: { phoneNumber: customerSession!.phoneNumber },
      }),
    enabled: !!customerSession?.phoneNumber,
  });
  const customerOrdersQuery = useQuery({
    queryKey: ["customer", "orders", customerSession?.phoneNumber ?? null],
    queryFn: () => fetchCustomerOrders({ data: { phoneNumber: customerSession!.phoneNumber } }),
    enabled: !!customerSession?.phoneNumber,
    refetchInterval: customerSession?.phoneNumber ? 7_000 : false,
  });
  const customerCarnetQuery = useCustomerCarnet(
    customerSession?.phoneNumber ?? null,
    fetchCustomerCarnetOverview,
  );
  const siteContentQuery = useQuery({
    queryKey: ["customer", "site-content"],
    queryFn: () => fetchActiveAdsAndAnnouncements(),
    refetchInterval: 8_000,
  });
  const categoriesQuery = useQuery({
    queryKey: ["customer", "categories", selectedNeighborhoodId || null],
    queryFn: () => fetchActiveCategories({ data: { neighborhoodId: selectedNeighborhoodId || null } }),
    enabled: !!selectedNeighborhoodId,
    refetchInterval: selectedNeighborhoodId ? 8_000 : false,
  });
  const flashDealsQuery = useQuery({
    queryKey: ["customer", "flash-deals", selectedNeighborhoodId || null],
    queryFn: () => fetchActiveFlashDeals({ data: { neighborhoodId: selectedNeighborhoodId } }),
    enabled: !!selectedNeighborhoodId,
    refetchInterval: selectedNeighborhoodId ? 10_000 : false,
  });
  const trackedOrderStatusRef = useRef<{ orderId: string; status: string } | null>(null);

  useEffect(() => {
    setFlashNowMs(Date.now());
    const timer = window.setInterval(() => setFlashNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const adsChannel = supabase
      .channel("site-content-ads")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_ads" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["customer", "site-content"] });
        },
      )
      .subscribe();

    const announcementsChannel = supabase
      .channel("site-content-announcements")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["customer", "site-content"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(adsChannel);
      void supabase.removeChannel(announcementsChannel);
    };
  }, [queryClient]);

  useEffect(() => {
    const orders = customerOrdersQuery.data ?? [];
    if (orders.length === 0) {
      trackedOrderStatusRef.current = null;
      return;
    }

    const activeOrder = orders.find((order) => order.status !== "delivered") ?? orders[0];
    const previous = trackedOrderStatusRef.current;

    if (!previous || previous.orderId !== activeOrder.id) {
      trackedOrderStatusRef.current = { orderId: activeOrder.id, status: activeOrder.status };
      return;
    }

    if (previous.status !== activeOrder.status) {
      trackedOrderStatusRef.current = { orderId: activeOrder.id, status: activeOrder.status };

      if (activeOrder.status === "delivering" || activeOrder.status === "delivered") {
        void playSuccessSound({ enabled: true });
      }
    }
  }, [customerOrdersQuery.data]);

  const serviceZones = serviceZonesQuery.data ?? [];
  const neighborhoodOptions =
    serviceZones.find((zone) => zone.id === selectedCommuneId)?.neighborhoods ?? [];
  const selectedNeighborhood = useMemo(() => {
    if (!selectedCommuneId || !selectedNeighborhoodId) {
      return null;
    }

    const commune = serviceZones.find((zone) => zone.id === selectedCommuneId);
    return commune?.neighborhoods.find((zone) => zone.id === selectedNeighborhoodId) ?? null;
  }, [selectedCommuneId, selectedNeighborhoodId, serviceZones]);
  const globalDeliveryFeeMad = Number(globalSettingsQuery.data?.global_delivery_fee ?? 10);
  const minimumOrderMad = Number(globalSettingsQuery.data?.minimum_order_amount ?? 50);
  const freeDeliveryThresholdMad = Number(globalSettingsQuery.data?.free_delivery_threshold ?? 500);

  const selectedLocationLabel = useMemo(() => {
    if (!selectedCommuneId || !selectedNeighborhoodId) {
      return t("header.locationFallback");
    }

    const commune = serviceZones.find((zone) => zone.id === selectedCommuneId);
    const neighborhood = commune?.neighborhoods.find((zone) => zone.id === selectedNeighborhoodId);

    if (!commune || !neighborhood) {
      return t("header.locationFallback");
    }

    return `${commune.name} / ${neighborhood.name}`;
  }, [selectedCommuneId, selectedNeighborhoodId, serviceZones, t]);

  const resolveLocationByNeighborhoodId = (neighborhoodId: string) => {
    for (const commune of serviceZones) {
      const neighborhood = commune.neighborhoods.find((zone) => zone.id === neighborhoodId);
      if (neighborhood) {
        return {
          communeId: commune.id,
          neighborhoodId: neighborhood.id,
          locationLabel: `${commune.name} / ${neighborhood.name}`,
        } satisfies PersistedLocation;
      }
    }

    return null;
  };

  const persistLocation = (location: PersistedLocation) => {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
  };

  const applyLocation = (location: PersistedLocation) => {
    setSelectedCommuneId(location.communeId);
    setSelectedNeighborhoodId(location.neighborhoodId);
    persistLocation(location);
    setIsLocationModalOpen(false);
  };

  const readPersistedLocation = () => {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as
        | PersistedLocation
        | {
            communeId?: string;
            neighborhoodId?: string;
          };

      if (!parsed.neighborhoodId) {
        return null;
      }

      const resolved = resolveLocationByNeighborhoodId(parsed.neighborhoodId);
      if (!resolved) {
        return null;
      }

      if (!parsed.communeId || parsed.communeId !== resolved.communeId) {
        persistLocation(resolved);
      }

      return resolved;
    } catch {
      localStorage.removeItem(LOCATION_STORAGE_KEY);
      return null;
    }
  };

  const categories = ((categoriesQuery.data ?? []) as CategoryChip[]).filter((category) => category.product_count > 0);
  const shouldAnimateCategories = categories.length > 3;

  const localizedProducts = useMemo<Product[]>(() => {
    const rows = catalogQuery.data?.pages.flatMap((page) => page.items ?? []) ?? [];
    return rows.map((item) => {
      const nameFr = "nameFr" in item ? item.nameFr : null;
      const nameAr = "nameAr" in item ? item.nameAr : null;
      const localizedName = getLocalizedText({ en: item.name, fr: nameFr, ar: nameAr });

      return {
        id: item.id,
        name: localizedName,
        nameFr,
        nameAr,
        category: item.category,
        categoryId: (item as { categoryId?: string | null }).categoryId ?? null,
        price: item.vendorPrice,
        measurementUnit: item.measurementUnit,
        image: item.imageUrl || productFallbackImage,
        alt: `${localizedName} product image`,
      };
    });
  }, [catalogQuery.data, getLocalizedText]);

  const displayedProducts = localizedProducts;
  const hasMoreProducts = !!catalogQuery.hasNextPage;

  const flashDeals = useMemo(() => {
    const rows = (flashDealsQuery.data ?? []) as Array<{
      id: string;
      name: string;
      nameFr?: string | null;
      nameAr?: string | null;
      measurementUnit: "Kg" | "Liter" | "Piece" | "Pack";
      imageUrl?: string | null;
      vendorPrice: number;
      flashSalePrice: number;
      flashSaleEndTime: string;
    }>;

    return rows.map((row) => {
      const localizedName = getLocalizedText({ en: row.name, fr: row.nameFr, ar: row.nameAr });
      const discountPercent = Math.max(
        1,
        Math.round(((Number(row.vendorPrice) - Number(row.flashSalePrice)) / Number(row.vendorPrice || 1)) * 100),
      );

      return {
        id: row.id,
        name: localizedName,
        nameFr: row.nameFr,
        nameAr: row.nameAr,
        category: "Pantry" as ProductCategory,
        categoryId: null,
        price: Number(row.vendorPrice),
        dealPrice: Number(row.flashSalePrice),
        measurementUnit: row.measurementUnit,
        image: row.imageUrl || productFallbackImage,
        alt: `${localizedName} product image`,
        flashSaleEndTime: row.flashSaleEndTime,
        discountPercent,
      };
    });
  }, [flashDealsQuery.data, getLocalizedText]);

  const countdownLabel = useMemo(() => {
    if (flashDeals.length === 0) {
      return "00:00:00";
    }

    const nearestEndMs = Math.min(...flashDeals.map((deal) => new Date(deal.flashSaleEndTime).getTime()));
    const total = Math.max(0, Math.floor((nearestEndMs - flashNowMs) / 1000));
    const hours = Math.floor(total / 3600)
      .toString()
      .padStart(2, "0");
    const minutes = Math.floor((total % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const seconds = Math.floor(total % 60)
      .toString()
      .padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }, [flashDeals, flashNowMs]);

  useEffect(() => {
    const persistedCustomerSession = localStorage.getItem(CUSTOMER_SESSION_STORAGE_KEY);
    if (!persistedCustomerSession) {
      return;
    }

    try {
      const parsed = JSON.parse(persistedCustomerSession) as CustomerSession;
      if (typeof parsed?.phoneNumber === "string" && /^\+212[0-9]{9}$/.test(parsed.phoneNumber)) {
        setCustomerSession({ phoneNumber: parsed.phoneNumber });
      }
    } catch {
      localStorage.removeItem(CUSTOMER_SESSION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (serviceZones.length === 0) {
      return;
    }

    const persistedLocation = readPersistedLocation();
    if (persistedLocation) {
      applyLocation(persistedLocation);
      return;
    }

    if (!customerSession?.phoneNumber && !selectedNeighborhoodId) {
      setIsLocationModalOpen(true);
    }
  }, [serviceZones, customerSession?.phoneNumber]);

  useEffect(() => {
    if (customerSession?.phoneNumber) {
      setPhoneNumber(customerSession.phoneNumber);
    } else {
      setPhoneNumber("");
    }
  }, [customerSession]);

  useEffect(() => {
    const profile = customerProfileQuery.data;
    if (customerSession?.phoneNumber && customerProfileQuery.isLoading) {
      return;
    }

    const persistedLocation = readPersistedLocation();
    if (persistedLocation) {
      applyLocation(persistedLocation);

      if (
        customerSession?.phoneNumber &&
        locationSyncRef.current !== `${customerSession.phoneNumber}:${persistedLocation.neighborhoodId}` &&
        profile?.neighborhoodId !== persistedLocation.neighborhoodId
      ) {
        locationSyncRef.current = `${customerSession.phoneNumber}:${persistedLocation.neighborhoodId}`;
        void syncCustomerNeighborhood({
          data: {
            phoneNumber: customerSession.phoneNumber,
            neighborhoodId: persistedLocation.neighborhoodId,
          },
        }).catch((error) => {
          console.error("Failed to sync customer neighborhood:", error);
          locationSyncRef.current = null;
        });
      }

      return;
    }

    if (profile) {
      setFullName((current) => (current.trim().length > 0 ? current : (profile.fullName ?? "")));
      setAddress((current) => (current.trim().length > 0 ? current : (profile.address ?? "")));
      setDeliveryNotes((current) =>
        current.trim().length > 0 ? current : (profile.savedInstructions ?? ""),
      );

      if (profile.neighborhoodId) {
        const profileLocation = resolveLocationByNeighborhoodId(profile.neighborhoodId);
        if (profileLocation) {
          applyLocation(profileLocation);
          return;
        }
      }
    }

    setIsLocationModalOpen(true);
  }, [
    customerProfileQuery.data,
    customerProfileQuery.isLoading,
    customerSession?.phoneNumber,
    serviceZones,
    syncCustomerNeighborhood,
  ]);

  const normalizedAuthPhone = useMemo(
    () => normalizeMoroccoPhoneInput(authPhoneInput),
    [authPhoneInput],
  );
  const isAuthPhoneValid = isValidMoroccoPhone(normalizedAuthPhone);

  const sendCustomerOtp = async () => {
    if (!isAuthPhoneValid) {
      toast.error("Please enter a valid Moroccan phone number.");
      return;
    }

    setIsSendingAuthCode(true);
    try {
      const fullPhoneNumber = formatMoroccoPhoneForPayload(normalizedAuthPhone);
      const otpPayload = await createOtpRequestFn({
        data: { phoneNumber: fullPhoneNumber },
      });

      setAuthPhoneForOtp(fullPhoneNumber);
      toast.success("Code sent on WhatsApp.");
      setAuthStep("otp");

      fetch(OTP_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: otpPayload.phoneNumber,
          otpCode: otpPayload.otpCode,
        }),
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Webhook request failed with status ${response.status}`);
        }
      }).catch((error) => {
        console.error("OTP webhook trigger failed:", error);
        toast.error("Code generated, but WhatsApp delivery is delayed. Please retry in a moment.");
      });
    } catch {
      toast.error("Unable to send code right now. Please try again.");
    } finally {
      setIsSendingAuthCode(false);
    }
  };

  const verifyCustomerOtpAndLogin = async () => {
    if (authOtpCode.length !== 4) {
      toast.error("Please enter the 4-digit code.");
      return;
    }

    setIsVerifyingAuthOtp(true);
    try {
      const phoneNumberToVerify = authPhoneForOtp || formatMoroccoPhoneForPayload(normalizedAuthPhone);
      const verification = await verifyOtpCodeFn({
        data: {
          phoneNumber: phoneNumberToVerify,
          otpCode: authOtpCode,
        },
      });

      if (!verification.verified) {
        toast.error("Wrong Code");
        return;
      }

      const session = {
        phoneNumber: phoneNumberToVerify,
      } satisfies CustomerSession;

      setCustomerSession(session);
      localStorage.setItem(CUSTOMER_SESSION_STORAGE_KEY, JSON.stringify(session));
      setIsCustomerAuthModalOpen(false);
      setAuthStep("phone");
      setAuthPhoneForOtp("");
      setAuthOtpCode("");
      toast.success("Logged in successfully.");
    } catch {
      toast.error("Unable to verify code right now. Please try again.");
    } finally {
      setIsVerifyingAuthOtp(false);
    }
  };

  const logoutCustomer = () => {
    localStorage.removeItem(CUSTOMER_SESSION_STORAGE_KEY);
    setCustomerSession(null);
    setAuthStep("phone");
    setAuthPhoneForOtp("");
    setAuthOtpCode("");
    setAuthPhoneInput("");
    setIsCustomerAuthModalOpen(false);
    toast.success("Logged out.");
  };

  const statusSteps: Array<{ label: string; statuses: string[] }> = [
    { label: "Order Placed", statuses: ["new"] },
    { label: "Preparing", statuses: ["preparing", "ready"] },
    { label: "Out for Delivery", statuses: ["delivering"] },
    { label: "Delivered", statuses: ["delivered"] },
  ];

  const getOrderStepIndex = (status: string) => {
    const index = statusSteps.findIndex((step) => step.statuses.includes(status));
    return index < 0 ? 0 : index;
  };

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrderIds((current) => ({
      ...current,
      [orderId]: !current[orderId],
    }));
  };

  const addToCart = (product: Product) => {
    if (!selectedNeighborhoodId) {
      setIsLocationModalOpen(true);
      toast.error("Select your delivery location first.");
      return;
    }

    addCartItem(product);

    toast.success("Added to cart", {
      description: product.name,
      duration: 1400,
    });
  };

  const addFlashDealToCart = (deal: {
    id: string;
    name: string;
    measurementUnit: "Kg" | "Liter" | "Piece" | "Pack";
    image: string;
    alt: string;
    dealPrice: number;
  }) => {
    if (!selectedNeighborhoodId) {
      setIsLocationModalOpen(true);
      toast.error("Select your delivery location first.");
      return;
    }

    addCartItem({
      id: deal.id,
      name: deal.name,
      price: deal.dealPrice,
      measurementUnit: deal.measurementUnit,
      image: deal.image,
      alt: deal.alt,
    });

    toast.success("Added to cart", {
      description: deal.name,
      duration: 1400,
    });
  };

  const openCheckout = () => {
    if (!selectedNeighborhoodId) {
      setIsLocationModalOpen(true);
      toast.error("Select your delivery location first.");
      return;
    }

    if (!customerSession?.phoneNumber) {
      closeCart();
      setIsCustomerAuthModalOpen(true);
      toast.error("Login is required before checkout.");
      return;
    }

    if (!isMinimumOrderMet) {
      closeCart();
      toast.error(
        isArabic
          ? `الحد الأدنى للطلب هو ${minimumOrderMad.toFixed(2)} درهم.`
          : `Minimum order amount is ${minimumOrderMad.toFixed(2)} MAD.`,
      );
      return;
    }

    closeCart();
    setCheckoutStep("details");
    setSelectedPaymentMethod("COD");
    setHasHydratedCheckoutProfile(false);
    setIsCheckoutOpen(true);
  };

  const confirmOrder = async () => {
    if (!customerSession?.phoneNumber) {
      setIsCustomerAuthModalOpen(true);
      toast.error("Please login first.");
      return;
    }

    if (!fullName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }

    if (!selectedNeighborhoodId) {
      setIsLocationModalOpen(true);
      toast.error("Select your delivery location first.");
      return;
    }

    if (!isMinimumOrderMet) {
      toast.error(
        isArabic
          ? `الحد الأدنى للطلب هو ${minimumOrderMad.toFixed(2)} درهم.`
          : `Minimum order amount is ${minimumOrderMad.toFixed(2)} MAD.`,
      );
      return;
    }

    try {
      setIsSubmittingOrder(true);

      await saveCustomerProfile({
        data: {
          phoneNumber: customerSession.phoneNumber,
          fullName: fullName.trim(),
          address: address.trim(),
          savedInstructions: deliveryNotes.trim(),
          neighborhoodId: selectedNeighborhoodId || null,
        },
      });

      await submitOrder({
        data: {
          customerName: fullName.trim(),
          customerPhone: customerSession.phoneNumber,
          neighborhoodId: selectedNeighborhoodId,
          deliveryNotes: deliveryNotes.trim(),
          paymentMethod: selectedPaymentMethod,
          deliveryFee: calculatedDeliveryFeeMad,
          totalPrice: finalTotalMad,
          itemCount: cartCount,
          items: cartItems.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unitPriceMad: item.price,
          })),
        },
      });

      setCheckoutStep("success");
      clearCart();
      toast.success("Order confirmed successfully.");
    } catch (error) {
      console.error("Failed to confirm order:", error);
      toast.error("Failed to confirm order. Please try again.");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const returnToHome = () => {
    setIsCheckoutOpen(false);
    setCheckoutStep("details");
  };

  const cartCount = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems],
  );

  const cartTotal = useMemo(
    () => cartItems.reduce((total, item) => total + item.price * item.quantity, 0),
    [cartItems],
  );
  const calculatedDeliveryFeeMad = useMemo(() => {
    if (cartTotal >= freeDeliveryThresholdMad) {
      return 0;
    }

    if (selectedNeighborhood) {
      return Number(selectedNeighborhood.deliveryFee ?? 0);
    }

    return globalDeliveryFeeMad;
  }, [cartTotal, freeDeliveryThresholdMad, selectedNeighborhood, globalDeliveryFeeMad]);
  const amountToFreeDeliveryMad = useMemo(
    () => Math.max(freeDeliveryThresholdMad - cartTotal, 0),
    [freeDeliveryThresholdMad, cartTotal],
  );
  const isMinimumOrderMet = cartTotal >= minimumOrderMad;
  const finalTotalMad = useMemo(() => cartTotal + calculatedDeliveryFeeMad, [cartTotal, calculatedDeliveryFeeMad]);

  const cartLabel = useMemo(() => `${cartCount} item${cartCount === 1 ? "" : "s"}`, [cartCount]);

  const paymentOptionsQuery = useQuery({
    queryKey: [
      "customer",
      "checkout-payment-options",
      customerSession?.phoneNumber ?? null,
      selectedNeighborhoodId,
      Number(finalTotalMad.toFixed(2)),
    ],
    queryFn: () =>
      fetchCheckoutPaymentOptions({
        data: {
          customerPhone: customerSession!.phoneNumber,
          neighborhoodId: selectedNeighborhoodId,
          cartTotal: finalTotalMad,
        },
      }),
    enabled: isCheckoutOpen && !!customerSession?.phoneNumber && !!selectedNeighborhoodId && finalTotalMad > 0,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!paymentOptionsQuery.data?.canUseCarnet && selectedPaymentMethod === "Carnet") {
      setSelectedPaymentMethod("COD");
    }
  }, [paymentOptionsQuery.data?.canUseCarnet, selectedPaymentMethod]);

  useEffect(() => {
    if (location.hash !== "checkout") {
      return;
    }

    if (cartItems.length === 0) {
      toast.error("Your cart is empty.");
      void navigate({ to: "/", replace: true });
      return;
    }

    openCheckout();
    void navigate({ to: "/", replace: true });
  }, [cartItems.length, location.hash, navigate, openCheckout]);

  const canConfirmOrder =
    !isSubmittingOrder &&
    !customerProfileQuery.isLoading &&
    cartItems.length > 0 &&
    fullName.trim().length > 0 &&
    address.trim().length > 0 &&
    isMinimumOrderMet &&
    !!customerSession?.phoneNumber &&
    !!selectedNeighborhoodId &&
    (selectedPaymentMethod === "COD" || paymentOptionsQuery.data?.canUseCarnet === true);

  const customerCarnet = customerCarnetQuery.data?.carnet ?? null;
  const hasVipCarnet = !!customerCarnet;
  const carnetCurrentDebt = Number(customerCarnet?.currentDebt ?? 0);
  const carnetMaxLimit = Number(customerCarnet?.maxLimit ?? 0);
  const carnetAvailableCredit = Math.max(carnetMaxLimit - carnetCurrentDebt, 0);
  const carnetUsagePercent = carnetMaxLimit > 0 ? Math.min((carnetCurrentDebt / carnetMaxLimit) * 100, 100) : 0;
  const activeAnnouncements = (siteContentQuery.data?.announcements ?? []) as AnnouncementRow[];
  const tickerText =
    activeAnnouncements.length > 0
      ? activeAnnouncements
          .map((item: AnnouncementRow) =>
            getLocalizedText({ en: item.content, fr: item.content_fr, ar: item.content_ar }),
          )
          .join("   •   ")
      : t("ticker.default");
  const tickerBgColor = activeAnnouncements[0]?.bg_color ?? "#deff9a";
  const tickerTextColor = activeAnnouncements[0]?.text_color ?? "#000000";
  const dynamicAdSlides =
    ((siteContentQuery.data?.ads ?? []) as SiteAdRow[]).map((ad: SiteAdRow) => ({
      id: ad.id,
      image: ad.image_url,
      linkUrl: ad.link_url,
      alt: "Promotional ad banner",
      headline: "Special Offer",
      copy: ad.link_url ? "Tap to discover this promotion" : "Featured promotion",
      tag: "AD" as const,
    })) || [];
  const displayAdSlides = dynamicAdSlides.length > 0 ? dynamicAdSlides : adSlides;

  const saveLocationSelection = async () => {
    if (!selectedCommuneId || !selectedNeighborhoodId) {
      toast.error("Please select both commune and neighborhood.");
      return;
    }

    const commune = serviceZones.find((zone) => zone.id === selectedCommuneId);
    const neighborhood = commune?.neighborhoods.find((zone) => zone.id === selectedNeighborhoodId);

    if (!commune || !neighborhood) {
      toast.error("Invalid location selection. Please try again.");
      return;
    }

    const location = {
      communeId: commune.id,
      neighborhoodId: neighborhood.id,
      locationLabel: `${commune.name} / ${neighborhood.name}`,
    } satisfies PersistedLocation;

    persistLocation(location);

    if (customerSession?.phoneNumber) {
      try {
        locationSyncRef.current = `${customerSession.phoneNumber}:${location.neighborhoodId}`;
        await syncCustomerNeighborhood({
          data: {
            phoneNumber: customerSession.phoneNumber,
            neighborhoodId: location.neighborhoodId,
          },
        });
      } catch (error) {
        console.error("Failed to sync customer neighborhood:", error);
        locationSyncRef.current = null;
        toast.error("Location saved locally, but cloud sync failed. Please retry.");
      }
    }

    setIsLocationModalOpen(false);
    toast.success("Delivery location saved.");
  };

  return (
    <>
      <main className="app-shell min-h-screen bg-muted/20 pb-24 text-foreground md:pb-0">
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm md:z-50 md:border-border/70 md:glass-panel">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
            <a href="#" className="inline-flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Bike className="size-5" />
              </span>
              <span className="text-base font-semibold tracking-tight text-gradient-brand">
                {t("brand.title")}
              </span>
            </a>

            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="ml-1 hidden items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted sm:inline-flex"
            >
              <MapPin className="size-3.5 text-primary" />
              {selectedLocationLabel}
            </button>

            <div className="relative ml-auto hidden min-w-0 max-w-md flex-1 sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Search products"
                placeholder={t("header.searchPlaceholder", { defaultValue: "Search essentials" })}
                className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("language.label")}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground transition hover:bg-muted"
                >
                  <Globe className="size-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-md">
                {languageOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.code}
                    onClick={() => changeLanguage(option.code)}
                    className={option.code === language ? "bg-accent text-accent-foreground" : undefined}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              aria-label={t("header.userProfile")}
              onClick={() => {
                openCustomerPanel("account");
              }}
              className="hidden h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground transition hover:bg-muted md:inline-flex"
            >
              <UserCircle2 className="size-5" />
            </button>

            {customerSession ? (
              <button
                aria-label={t("header.myOrders")}
                onClick={() => {
                  openCustomerPanel("orders");
                }}
                className="hidden h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground transition hover:bg-muted md:inline-flex"
              >
                <ClipboardList className="size-5" />
              </button>
            ) : null}

            <button
              aria-label={cartLabel}
              onClick={openCart}
              className="relative hidden h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground transition hover:bg-muted md:inline-flex"
            >
              <ShoppingCart className="size-5" />
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-destructive-foreground">
                {cartCount}
              </span>
            </button>
          </div>
          <div className="mx-auto w-full max-w-6xl px-4 pb-3 sm:hidden">
            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="mb-2 inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted"
            >
              <MapPin className="size-3.5 text-primary" />
              {selectedLocationLabel}
            </button>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={mobileSearchInputRef}
                aria-label="Search products"
                placeholder={t("header.searchPlaceholder", { defaultValue: "Search essentials" })}
                className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>
          </div>
        </header>

        <section
          className="overflow-hidden border-b border-border/70 py-2"
          style={{ backgroundColor: tickerBgColor, color: tickerTextColor }}
          aria-label="Global announcement ticker"
        >
          <div className={`marquee-track whitespace-nowrap text-sm font-medium ${isArabic ? "marquee-track-rtl" : ""}`}>
            <span className="mx-6">{tickerText}</span>
            <span className="mx-6" aria-hidden="true">
              {tickerText}
            </span>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 pt-4 sm:px-6 md:grid-cols-2 md:gap-8 md:pt-10">
          <div className="animate-fade-in hidden flex-col justify-center gap-4 md:flex">
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" />
              Bicycle delivery across Morocco
            </p>
            <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Daily groceries delivered in minutes, cleanly and reliably.
            </h1>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Fresh essentials from bakery to vegetables, delivered by local bicycle couriers for a
              faster and zero-emission Moroccan city experience.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <Button variant="hero" size="xl" className="rounded-2xl">
                Start shopping
              </Button>
              <span className="text-sm font-medium text-muted-foreground">Avg. delivery: 18 min</span>
            </div>
          </div>

          <div className="signature-tilt animate-enter h-[28vh] min-h-[170px] max-h-[30vh] overflow-hidden rounded-2xl border border-border/70 bg-card md:h-[410px] md:max-h-none">
            <Carousel opts={{ loop: true }} className="h-full">
              <CarouselContent className="h-full">
                {displayAdSlides.map((slide) => (
                  <CarouselItem key={slide.id} className="h-full pl-0">
                    <article className="relative h-full w-full overflow-hidden">
                      <img
                        src={slide.image}
                        alt={slide.alt}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        width={1920}
                        height={1080}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/35 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-3 text-background md:p-5">
                        <span className="mb-2 inline-flex rounded-md border border-background/60 bg-foreground/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
                          {slide.tag}
                        </span>
                        <p className="text-sm font-semibold leading-tight md:text-lg">{slide.headline}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-background/90 md:text-sm">{slide.copy}</p>
                      </div>
                      {slide.linkUrl ? (
                        <a
                          href={slide.linkUrl}
                          className="absolute inset-0"
                          aria-label="Open promotional offer"
                        />
                      ) : null}
                    </article>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
        </section>

        <section className="mx-auto mt-4 w-full max-w-6xl px-4 sm:px-6 md:mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">
              {t("categories.title", { defaultValue: "Quick categories" })}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">
                {t("categories.subtitleDefault", { defaultValue: "Essentials first" })}
              </span>
              <Link to="/customer/categories" className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
                {t("categories.viewAll", { defaultValue: "View All" })}
              </Link>
            </div>
          </div>
          <div
            className="category-scroll overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            onMouseEnter={() => setIsCategoryTickerPaused(true)}
            onMouseLeave={() => setIsCategoryTickerPaused(false)}
            onTouchStart={() => setIsCategoryTickerPaused(true)}
            onTouchEnd={() => setIsCategoryTickerPaused(false)}
          >
            {categories.length === 0 ? (
              <AppEmptyState
                title={t("categories.noCategories", { defaultValue: "No categories available in your area yet." })}
                subtitle="We’re preparing your neighborhood catalog."
                className="w-full"
              />
            ) : (
              <div
                className={shouldAnimateCategories ? `category-marquee-track ${isArabic ? "category-marquee-track-rtl" : ""}` : "inline-flex items-stretch"}
                style={
                  shouldAnimateCategories
                    ? { animationPlayState: isCategoryTickerPaused ? "paused" : "running" }
                    : undefined
                }
              >
                {(shouldAnimateCategories ? [...categories, ...categories] : categories).map((item, index) => {
                  const categoryName = getLocalizedText({
                    en: item.name_en,
                    fr: item.name_fr,
                    ar: item.name_ar,
                  });

                  return (
                    <Link
                      to="/customer/categories/$id"
                      params={{ id: item.id }}
                      key={shouldAnimateCategories ? `${item.id}-${index}` : item.id}
                      className="mx-1 inline-flex min-w-[92px] flex-col items-center gap-2 rounded-2xl border border-border bg-card px-2 py-2 text-center shadow-sm"
                    >
                      <span
                        className="flex h-14 w-14 items-center justify-center rounded-2xl"
                        style={{ backgroundColor: item.accent_color || "var(--color-muted)" }}
                      >
                        {item.image_url ? (
                          <img
                            src={item.image_url || fallbackProductImage}
                            alt={categoryName}
                            className="h-8 w-8 object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <CategoryIcon iconName={item.icon_name} className="h-8 w-8 text-foreground" />
                        )}
                      </span>
                      <span className="line-clamp-1 text-xs font-semibold text-foreground">{categoryName}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto mt-5 w-full max-w-6xl px-4 pb-10 sm:px-6 md:mt-8">
          <div className="mb-4 flex items-center justify-between">
            <Link to="/customer/all-products" className="text-lg font-semibold tracking-tight text-foreground">
              {t("products.title")}
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">{t("products.pricesInMad")}</span>
              <Link to="/customer/all-products" className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
                {t("categories.viewAll", { defaultValue: "View All" })}
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {displayedProducts.map((product) => (
              <article
                key={product.id}
                className="signature-tilt group overflow-hidden rounded-2xl border border-border bg-card"
              >
                <Link to="/customer/product/$id" params={{ id: product.id }} className="block">
                  <div className="aspect-square overflow-hidden rounded-xl bg-muted/40">
                    <img
                      src={product.image}
                      alt={product.alt}
                      className="h-full w-full object-contain object-center p-2"
                      loading="lazy"
                      width={1024}
                      height={768}
                    />
                  </div>
                  <div className="p-3 sm:p-4">
                    <h3 className="line-clamp-2 text-sm font-semibold tracking-tight sm:text-base">
                      {product.name}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-primary">
                      {product.price} MAD / {product.measurementUnit}
                    </p>
                  </div>
                </Link>
                <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                  <Button
                    variant="soft"
                    size="sm"
                    className="w-full rounded-xl"
                    onClick={() => addToCart(product)}
                  >
                    <Plus className="size-4" />
                    {t("products.add")}
                  </Button>
                </div>
              </article>
            ))}
          </div>

          {displayedProducts.length > 0 && hasMoreProducts ? (
            <div className="mt-5 flex justify-center">
              <Button
                variant="outline"
                className="rounded-xl px-6"
                onClick={() => catalogQuery.fetchNextPage()}
                disabled={catalogQuery.isFetchingNextPage}
              >
                {catalogQuery.isFetchingNextPage ? "..." : t("products.loadMore")}
              </Button>
            </div>
          ) : null}

          {displayedProducts.length === 0 ? (
            <AppEmptyState
              title={t("products.empty")}
              subtitle="Try changing category or search terms."
              className="mt-4"
            />
          ) : null}
        </section>

        {flashDeals.length > 0 ? (
        <section className="mx-auto mt-2 w-full max-w-6xl px-4 pb-3 sm:px-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
              <Flame className="size-4 text-destructive" />
              {t("flashDeals.title")}
            </h2>
            <div className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
              <Clock3 className="size-3.5" />
              <span>{t("flashDeals.endsIn")}: {countdownLabel}</span>
            </div>
          </div>

          <Carousel
            opts={{ loop: flashDeals.length > 1, align: "start", skipSnaps: false, dragFree: false }}
            plugins={flashDeals.length > 1 ? [flashDealsAutoplayRef.current] : []}
            className="mb-5"
            onPointerDownCapture={() => flashDealsAutoplayRef.current.stop()}
            onPointerUpCapture={() => flashDealsAutoplayRef.current.play()}
            onTouchStartCapture={() => flashDealsAutoplayRef.current.stop()}
            onTouchEndCapture={() => flashDealsAutoplayRef.current.play()}
            onMouseEnter={() => flashDealsAutoplayRef.current.stop()}
            onMouseLeave={() => flashDealsAutoplayRef.current.play()}
          >
            <CarouselContent className="-ml-0 gap-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {flashDeals.map((product) => (
                <CarouselItem key={`flash-${product.id}`} className="basis-[170px] pl-0">
                  <article className="relative w-[170px] overflow-hidden rounded-2xl border border-border bg-card">
                    <Link to="/product/$id" params={{ id: product.id }} className="block">
                      <span className="absolute left-2 top-2 z-10 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
                        -{product.discountPercent}%
                      </span>
                      <div className="aspect-square overflow-hidden bg-muted/40">
                        <img
                          src={product.image}
                          alt={product.alt}
                          className="h-full w-full object-contain object-center p-2"
                          loading="lazy"
                        />
                      </div>
                      <div className="space-y-1 p-2.5">
                        <p className="line-clamp-1 text-xs font-semibold text-foreground">{product.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-destructive">{product.dealPrice} MAD</span>
                          <span className="text-[11px] text-muted-foreground line-through">{product.price} MAD</span>
                        </div>
                      </div>
                    </Link>
                    <div className="px-2.5 pb-2.5">
                      <Button
                        variant="soft"
                        size="sm"
                        className="w-full rounded-xl"
                        onClick={() => addFlashDealToCart(product)}
                      >
                        <Plus className="size-4" />
                        {t("products.add")}
                      </Button>
                    </div>
                  </article>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>

          {!isBottomPromoDismissed ? (
            <div className="relative mb-20 overflow-hidden rounded-2xl border border-success/30 bg-card">
              <button
                type="button"
                onClick={() => setIsBottomPromoDismissed(true)}
                aria-label="Dismiss promotions"
                className="absolute right-2 top-2 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background/90 text-muted-foreground"
              >
                <X className="size-4" />
              </button>

              <Carousel
                opts={{ loop: true, align: "start", skipSnaps: false, dragFree: false }}
                plugins={[bottomPromoAutoplayRef.current]}
                className="w-full"
                onPointerDownCapture={() => bottomPromoAutoplayRef.current.stop()}
                onPointerUpCapture={() => bottomPromoAutoplayRef.current.play()}
                onTouchStartCapture={() => bottomPromoAutoplayRef.current.stop()}
                onTouchEndCapture={() => bottomPromoAutoplayRef.current.play()}
                onMouseEnter={() => bottomPromoAutoplayRef.current.stop()}
                onMouseLeave={() => bottomPromoAutoplayRef.current.play()}
              >
                <CarouselContent>
                  <CarouselItem className="pl-0">
                    <article className="surface-panel flex items-center gap-3 px-4 py-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                        <Share2 className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{t("flashDeals.inviteTitle")}</p>
                        <p className="text-xs text-muted-foreground">{t("flashDeals.inviteCopy")}</p>
                        <p className="mt-1 text-[11px] font-semibold text-primary">{t("flashDeals.freeDelivery")}</p>
                      </div>
                      <button className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Share2 className="size-4" />
                      </button>
                    </article>
                  </CarouselItem>

                  <CarouselItem className="pl-0">
                    <article className="surface-panel flex items-center gap-3 px-4 py-2.5">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                        <ShieldCheck className="size-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{t("flashDeals.ecoTitle")}</p>
                        <p className="text-xs text-muted-foreground">{t("flashDeals.ecoCopy")}</p>
                      </div>
                    </article>
                  </CarouselItem>
                </CarouselContent>
              </Carousel>
            </div>
          ) : null}
        </section>
        ) : null}
      </main>

      {isCheckoutOpen ? (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" />
          <section className="absolute inset-0 flex flex-col bg-background animate-in fade-in duration-300">
            <header className="flex items-start justify-between border-b border-border px-4 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Checkout</h2>
                <p className="text-sm text-muted-foreground">Review and confirm your delivery</p>
              </div>
              <button
                aria-label="Close checkout"
                onClick={() => setIsCheckoutOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </header>

            {checkoutStep === "success" ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <span className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-success/15 text-success">
                  <CheckCircle2 className="size-10" />
                </span>
                <h3 className="mt-6 text-2xl font-semibold text-foreground">Order Placed Successfully!</h3>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                  Your cyclist is on the way.
                </p>
                <Button variant="hero" className="mt-8 rounded-xl" onClick={returnToHome}>
                  <House className="size-4" />
                  Return to Home
                </Button>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-28 pt-4">
                  <section className="space-y-2 rounded-2xl border border-primary/30 bg-primary/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Delivery Location</p>
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <MapPin className="size-4 text-primary" />
                      <span>{selectedLocationLabel}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Locked from your onboarding selection</p>
                  </section>

                  <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground">Delivery Details</h3>
                    {customerSession?.phoneNumber && customerProfileQuery.isLoading ? (
                      <div className="space-y-2">
                        <div className="h-10 animate-pulse rounded-xl bg-muted/50" />
                        <div className="h-10 animate-pulse rounded-xl bg-muted/50" />
                        <div className="h-10 animate-pulse rounded-xl bg-muted/50" />
                        <div className="h-24 animate-pulse rounded-xl bg-muted/50" />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground" htmlFor="fullName">
                            Full Name
                          </label>
                          <input
                            id="fullName"
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            placeholder="Enter your full name"
                            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground" htmlFor="phoneNumber">
                            Phone Number
                          </label>
                          <div className="flex h-10 items-center overflow-hidden rounded-xl border border-input bg-muted/60">
                            <span className="px-3 text-sm font-medium text-muted-foreground">+212</span>
                            <input
                              id="phoneNumber"
                              value={phoneNumber.replace(/^\+212/, "")}
                              inputMode="numeric"
                              autoComplete="tel"
                              readOnly
                              className="h-full w-full border-0 bg-transparent px-1.5 pr-3 text-sm text-foreground outline-none"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground" htmlFor="address">
                            Address
                          </label>
                          <input
                            id="address"
                            value={address}
                            onChange={(event) => setAddress(event.target.value)}
                            placeholder="Street, building, apartment..."
                            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground" htmlFor="deliveryNotes">
                            Delivery Instructions (Optional)
                          </label>
                          <textarea
                            id="deliveryNotes"
                            value={deliveryNotes}
                            onChange={(event) => setDeliveryNotes(event.target.value)}
                            placeholder="Example: call before arrival, leave at door, or gate code"
                            className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                          />
                        </div>
                      </>
                    )}
                  </section>

                  <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground">Payment Method</h3>
                    <RadioGroup
                      value={selectedPaymentMethod}
                      onValueChange={(value) =>
                        value === "COD" || value === "Carnet" ? setSelectedPaymentMethod(value) : undefined
                      }
                      className="space-y-2"
                    >
                      <Label
                        htmlFor="payment-cod"
                        className={`flex w-full cursor-pointer items-center justify-between rounded-xl border p-3 text-left ${
                          selectedPaymentMethod === "COD"
                            ? "border-primary/30 bg-primary/10"
                            : "border-border bg-background"
                        }`}
                      >
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                            <HandCoins className="size-4" />
                          </span>
                          Cash on Delivery (COD)
                        </span>
                        <RadioGroupItem id="payment-cod" value="COD" />
                      </Label>

                      {paymentOptionsQuery.data?.canUseCarnet ? (
                        <Label
                          htmlFor="payment-carnet"
                          className={`flex w-full cursor-pointer items-center justify-between rounded-xl border p-3 text-left ${
                            selectedPaymentMethod === "Carnet"
                              ? "border-primary/30 bg-primary/10"
                              : "border-border bg-background"
                          }`}
                        >
                          <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground">
                              <CreditCard className="size-4" />
                            </span>
                            Add to Carnet (Pay Later)
                          </span>
                          <RadioGroupItem id="payment-carnet" value="Carnet" />
                        </Label>
                      ) : null}
                    </RadioGroup>
                    {paymentOptionsQuery.isFetching ? (
                      <p className="text-xs text-muted-foreground">Checking carnet eligibility...</p>
                    ) : !paymentOptionsQuery.data?.canUseCarnet && paymentOptionsQuery.data?.reason ? (
                      <p className="text-xs text-muted-foreground">{paymentOptionsQuery.data.reason}</p>
                    ) : null}
                  </section>

                  <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground">Order Summary</h3>
                    <div className="space-y-2">
                      {cartItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <p className="text-foreground">
                            {item.name} <span className="text-muted-foreground">x{item.quantity}</span>
                          </p>
                          <p className="font-medium text-foreground">{item.price * item.quantity} MAD</p>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border pt-3">
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">{isArabic ? "رسوم التوصيل" : "Delivery Fee"}</p>
                        <p className="text-sm font-medium text-foreground">
                          {selectedNeighborhoodId ? `${calculatedDeliveryFeeMad.toFixed(2)} MAD` : isArabic ? "قيد التحديد" : "Pending"}
                        </p>
                      </div>
                      {selectedNeighborhoodId ? (
                        <div className="mb-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2">
                          <p className="inline-flex items-center gap-2 text-xs font-semibold text-success">
                            <Gift className="size-3.5" />
                            {amountToFreeDeliveryMad > 0
                              ? isArabic
                                ? `زيد ${amountToFreeDeliveryMad.toFixed(2)} درهم باش تستافد من توصيل فابور!`
                                : `Spend ${amountToFreeDeliveryMad.toFixed(2)} MAD more to get FREE Delivery!`
                              : isArabic
                                ? "مبروك! عندك توصيل فابور"
                                : "You have unlocked Free Delivery! 🎉"}
                          </p>
                        </div>
                      ) : null}
                      {!isMinimumOrderMet ? (
                        <p className="mb-2 text-xs font-medium text-destructive">
                          {isArabic
                            ? `الحد الأدنى للطلب هو ${minimumOrderMad.toFixed(2)} درهم.`
                            : `Minimum order amount is ${minimumOrderMad.toFixed(2)} MAD.`}
                        </p>
                      ) : null}
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Final Total</p>
                        <p className="text-lg font-semibold text-foreground">{finalTotalMad.toFixed(2)} MAD</p>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-background/95 p-4 backdrop-blur">
                  <Button
                    variant="hero"
                    size="lg"
                    className="w-full rounded-xl"
                    onClick={confirmOrder}
                    disabled={!canConfirmOrder}
                  >
                    {isSubmittingOrder ? "Confirming..." : "Confirm Order"}
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      {isCustomerAuthModalOpen ? (
        <div className="fixed inset-0 z-[120]">
          <div className="absolute inset-0 bg-black/50" />
          <section className="absolute inset-0 flex items-end justify-center px-0 sm:items-center sm:px-4">
            <div className="h-[92vh] w-[95vw] max-w-md overflow-y-auto rounded-t-2xl border border-border bg-background p-5 shadow-2xl sm:h-auto sm:rounded-2xl">
              <h2 className="text-lg font-semibold text-foreground">
                {customerSession ? "Account" : "Customer Login"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {customerSession
                  ? "You are currently signed in."
                  : "Sign in with your WhatsApp OTP to continue."}
              </p>

              {customerSession && customerPanelView === "account" ? (
                <div className="mt-4 space-y-3">
                  <section className="space-y-2 rounded-2xl border border-primary/30 bg-primary/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Phone Number</p>
                    <p className="text-sm font-medium text-foreground">{customerSession.phoneNumber}</p>
                  </section>
                  <Button variant="hero" className="w-full rounded-xl" onClick={() => setCustomerPanelView("profile")}>
                    View & Edit Profile
                  </Button>
                  <Button variant="soft" className="w-full rounded-xl" onClick={() => setIsCustomerAuthModalOpen(false)}>
                    Close
                  </Button>
                  <Button variant="destructive" className="w-full rounded-xl" onClick={logoutCustomer}>
                    Logout
                  </Button>
                </div>
              ) : customerSession && customerPanelView === "profile" ? (
                <div className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <label htmlFor="profile-full-name" className="text-xs font-medium text-muted-foreground">
                      Full Name
                    </label>
                    <input
                      id="profile-full-name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Enter your full name"
                      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="profile-phone" className="text-xs font-medium text-muted-foreground">
                      Phone Number
                    </label>
                    <input
                      id="profile-phone"
                      value={phoneNumber}
                      readOnly
                      className="h-10 w-full rounded-xl border border-input bg-muted/50 px-3 text-sm text-foreground outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="profile-address" className="text-xs font-medium text-muted-foreground">
                      Address
                    </label>
                    <textarea
                      id="profile-address"
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder="Street, building, apartment..."
                      className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                  <Button
                    variant="hero"
                    className="w-full rounded-xl"
                    onClick={async () => {
                      if (!customerSession?.phoneNumber || !fullName.trim()) {
                        toast.error("Please complete profile details first.");
                        return;
                      }

                      try {
                        await saveCustomerProfile({
                          data: {
                            phoneNumber: customerSession.phoneNumber,
                            fullName: fullName.trim(),
                            address: address.trim(),
                            savedInstructions: deliveryNotes.trim(),
                            neighborhoodId: selectedNeighborhoodId || null,
                          },
                        });
                        toast.success("Profile updated.");
                        setCustomerPanelView("account");
                      } catch (error) {
                        console.error("Failed to update customer profile:", error);
                        toast.error("Failed to update profile.");
                      }
                    }}
                  >
                    Save Profile
                  </Button>
                  <Button variant="soft" className="w-full rounded-xl" onClick={() => setCustomerPanelView("account")}>
                    Back to Account
                  </Button>
                </div>
              ) : customerSession && customerPanelView === "orders" ? (
                <div className="mt-4 space-y-3">
                  {customerOrdersQuery.isLoading ? (
                    <AppEmptyState title="Loading your orders..." subtitle="Please wait a moment." className="p-5" />
                  ) : (customerOrdersQuery.data?.length ?? 0) === 0 ? (
                    <AppEmptyState
                      title="No orders yet."
                      subtitle="Your order history will appear here after checkout."
                      className="p-5"
                    />
                  ) : (
                    <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
                      {(customerOrdersQuery.data ?? []).map((order) => {
                        const activeStepIndex = getOrderStepIndex(order.status);
                        const isExpanded = !!expandedOrderIds[order.id];
                        const orderDate = new Date(order.created_at);

                        return (
                          <article key={order.id} className="rounded-2xl border border-border bg-card p-4">
                            <button
                              type="button"
                              className="w-full text-left"
                              onClick={() => toggleOrderExpansion(order.id)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-foreground">Order #{order.id.slice(0, 8).toUpperCase()}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">{orderDate.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-foreground">{Number(order.total_price ?? 0).toFixed(2)} MAD</p>
                                  <p className="mt-1 text-xs text-muted-foreground">{order.item_count} items</p>
                                </div>
                              </div>

                              <div className="mt-4 grid grid-cols-4 gap-2">
                                {statusSteps.map((step, index) => {
                                  const reached = index <= activeStepIndex;
                                  return (
                                    <div key={step.label} className="space-y-1">
                                      <div className={`h-1.5 rounded-full ${reached ? "bg-primary" : "bg-muted"}`} />
                                      <p className={`text-[10px] leading-tight ${reached ? "text-foreground" : "text-muted-foreground"}`}>
                                        {step.label}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>

                              {order.status === "delivering" ? (
                                <div className="mt-4 rounded-xl border border-primary/40 bg-primary/10 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Delivery Pass</p>
                                  <div className="mt-3 flex justify-center">
                                    <div className="rounded-xl bg-background p-3 shadow-sm">
                                      <QRCodeSVG
                                        value={JSON.stringify({ orderId: order.id, code: order.delivery_auth_code })}
                                        size={192}
                                        level="M"
                                        includeMargin
                                      />
                                    </div>
                                  </div>
                                  <p className="mt-3 text-center text-lg font-semibold text-foreground">
                                    PIN: {order.delivery_auth_code}
                                  </p>
                                </div>
                              ) : null}

                              <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                                {isExpanded ? "Hide details" : "View details"}
                                <ChevronDown className={`size-3.5 transition ${isExpanded ? "rotate-180" : "rotate-0"}`} />
                              </div>
                            </button>

                            {isExpanded ? (
                              <div className="mt-3 space-y-2 border-t border-border pt-3">
                                {(order.order_items ?? []).map((item, index) => (
                                  <div key={`${order.id}-${index}`} className="flex items-center justify-between text-sm">
                                    <p className="text-foreground">
                                      {item.name} <span className="text-muted-foreground">x{item.quantity}</span>
                                    </p>
                                    <p className="font-medium text-foreground">{Number(item.unitPriceMad).toFixed(2)} MAD</p>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  )}

                  <Button variant="soft" className="w-full rounded-xl" onClick={() => setCustomerPanelView("account")}>
                    Back to Account
                  </Button>
                </div>
              ) : customerSession && customerPanelView === "carnet" ? (
                <div className="mt-4 space-y-3">
                  {customerCarnetQuery.isLoading ? (
                    <AppEmptyState title="Loading your carnet..." subtitle="Fetching your latest ledger details." className="p-5" />
                  ) : !customerCarnet ? (
                    <AppEmptyState
                      title="No active carnet found for your account."
                      subtitle="Ask your vendor to enable carnet access for your phone number."
                      className="p-5"
                    />
                  ) : (
                    <>
                      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-border bg-muted/30 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Your Current Balance
                            </p>
                            <p className="mt-1 text-xl font-semibold text-destructive">
                              {carnetCurrentDebt.toFixed(2)} MAD
                            </p>
                          </div>
                          <div className="rounded-xl border border-border bg-muted/30 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Available Credit
                            </p>
                            <p className="mt-1 text-xl font-semibold text-success">
                              {carnetAvailableCredit.toFixed(2)} MAD
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Credit usage</span>
                            <span>{carnetUsagePercent.toFixed(0)}%</span>
                          </div>
                          <Progress value={carnetUsagePercent} className="h-2" />
                        </div>
                      </section>

                      <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
                        <h3 className="text-sm font-semibold text-foreground">Transaction History</h3>
                        <div className="max-h-[36vh] space-y-2 overflow-y-auto pr-1">
                          {(customerCarnetQuery.data?.transactions ?? []).length === 0 ? (
                            <p className="rounded-xl border border-dashed border-border bg-muted/30 p-3 text-center text-sm text-muted-foreground">
                              No carnet transactions yet.
                            </p>
                          ) : (
                            (customerCarnetQuery.data?.transactions ?? []).map((entry: {
                              id: string;
                              kind: "debt" | "payment";
                              description: string;
                              createdAt: string;
                              amount: number;
                            }) => {
                              const isDebt = entry.kind === "debt";
                              return (
                                <article
                                  key={entry.id}
                                  className="flex items-center justify-between rounded-xl border border-border bg-background p-3"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{entry.description}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(entry.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                  <p className={`text-sm font-semibold ${isDebt ? "text-destructive" : "text-success"}`}>
                                    {isDebt ? "+" : "-"}
                                    {Number(entry.amount ?? 0).toFixed(2)} MAD
                                  </p>
                                </article>
                              );
                            })
                          )}
                        </div>
                      </section>
                    </>
                  )}

                  <Button variant="soft" className="w-full rounded-xl" onClick={() => setCustomerPanelView("account")}>
                    Back to Account
                  </Button>
                </div>
              ) : authStep === "phone" ? (
                <div className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <label htmlFor="customer-auth-phone" className="text-xs font-medium text-muted-foreground">
                      Phone Number
                    </label>
                    <div className="flex h-11 items-center overflow-hidden rounded-xl border border-input bg-background focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/30">
                      <span className="px-3 text-sm font-medium text-muted-foreground">+212</span>
                      <input
                        id="customer-auth-phone"
                        value={authPhoneInput}
                        onChange={(event) => setAuthPhoneInput(normalizeMoroccoPhoneInput(event.target.value))}
                        placeholder="6XXXXXXXX"
                        inputMode="numeric"
                        autoComplete="tel"
                        className="h-full w-full border-0 bg-transparent px-1.5 pr-3 text-sm outline-none"
                      />
                    </div>
                  </div>

                  <Button
                    variant="hero"
                    className="w-full rounded-xl"
                    onClick={sendCustomerOtp}
                    disabled={!isAuthPhoneValid || isSendingAuthCode}
                  >
                    <MessageCircle className="size-4" />
                    {isSendingAuthCode ? "Sending..." : "Send Code via WhatsApp"}
                  </Button>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <p className="text-center text-sm text-muted-foreground">Enter the 4-digit code sent to WhatsApp</p>
                  <div className="flex justify-center">
                    <InputOTP
                      value={authOtpCode}
                      onChange={(value) => setAuthOtpCode(value.replace(/\D/g, "").slice(0, 4))}
                      maxLength={4}
                      inputMode="numeric"
                    >
                      <InputOTPGroup className="gap-2">
                        <InputOTPSlot index={0} className="h-12 w-12 rounded-lg border border-input text-lg" />
                        <InputOTPSlot index={1} className="h-12 w-12 rounded-lg border border-input text-lg" />
                        <InputOTPSlot index={2} className="h-12 w-12 rounded-lg border border-input text-lg" />
                        <InputOTPSlot index={3} className="h-12 w-12 rounded-lg border border-input text-lg" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <Button
                    variant="hero"
                    className="w-full rounded-xl"
                    onClick={verifyCustomerOtpAndLogin}
                    disabled={authOtpCode.length !== 4 || isVerifyingAuthOtp}
                  >
                    {isVerifyingAuthOtp ? "Verifying..." : "Verify & Login"}
                  </Button>

                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setAuthStep("phone");
                      setAuthPhoneForOtp("");
                      setAuthOtpCode("");
                    }}
                  >
                    Change phone number
                  </Button>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {isLocationModalOpen ? (
        <div className="fixed inset-0 z-[90]">
          <div className="absolute inset-0 bg-black/50" />
          <section className="absolute inset-0 flex items-center justify-center px-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl">
              <h2 className="text-lg font-semibold text-foreground">Select Your Delivery Location</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose your Jamaa Tourabiya and Hay / Douar before placing orders.
              </p>

              <div className="mt-4 space-y-3">
                <div className="space-y-2">
                  <label htmlFor="location-commune" className="text-xs font-medium text-muted-foreground">
                    Jamaa Tourabiya
                  </label>
                  <select
                    id="location-commune"
                    value={selectedCommuneId}
                    onChange={(event) => {
                      setSelectedCommuneId(event.target.value);
                      setSelectedNeighborhoodId("");
                    }}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="">Select commune</option>
                    {serviceZones.map((commune) => (
                      <option key={commune.id} value={commune.id}>
                        {commune.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="location-neighborhood" className="text-xs font-medium text-muted-foreground">
                    Hay / Douar
                  </label>
                  <select
                    id="location-neighborhood"
                    value={selectedNeighborhoodId}
                    onChange={(event) => setSelectedNeighborhoodId(event.target.value)}
                    disabled={!selectedCommuneId}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="">Select neighborhood</option>
                    {neighborhoodOptions.map((neighborhood) => (
                      <option key={neighborhood.id} value={neighborhood.id}>
                        {neighborhood.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Button
                variant="hero"
                className="mt-5 w-full rounded-xl"
                onClick={saveLocationSelection}
                disabled={!selectedCommuneId || !selectedNeighborhoodId || serviceZonesQuery.isLoading}
              >
                Confirm Location
              </Button>
            </div>
          </section>
        </div>
      ) : null}

    </>
  );
}
