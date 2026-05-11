import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useReactToPrint } from "react-to-print";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import {
  Banknote,
  BadgeCheck,
  Boxes,
  Zap,
  BookUser,
  CheckCircle2,
  ChevronDown,
  Clock3,
  History,
  LogOut,
  MessageCircle,
  Package,
  Phone,
  QrCode,
  Search,
  ShoppingBag,
  Store,
  Truck,
  Volume2,
  VolumeX,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState as AppEmptyState } from "@/components/ui/empty-state";
import { getVendorInventoryData, updateVendorFlashSale, upsertVendorInventoryItem } from "@/lib/catalog.functions";
import {
  getCarnetCustomerLedger,
  getVendorCarnetData,
  lookupCustomerByPhone,
  recordVendorCarnetPayment,
  verifyAndAddVendorCarnetCustomer,
} from "@/lib/carnet.functions";
import { createOtpRequest } from "@/lib/customers.functions";
import {
  formatMoroccoPhoneForPayload,
  isValidMoroccoPhone,
  normalizeMoroccoPhoneInput,
} from "@/lib/morocco-phone";
import { getVendorDashboardData, updateVendorOrderStatus } from "@/lib/orders.functions";
import { getInvoiceSettings } from "@/lib/invoice-settings.functions";
import { playAlertSound } from "@/lib/sound-alerts";
import fallbackProductImage from "@/assets/product-vegetables.jpg";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { clearRoleSessions } from "@/lib/operational-auth";
import {
  ThermalReceipt,
  type ThermalInvoiceSettings,
  type ThermalReceiptOrder,
} from "@/components/ThermalReceipt";

type MainView = "orders" | "history" | "inventory" | "flashSales" | "carnet";
type OrderQueueTab = "new" | "preparing" | "ready";
type HistoryFilter = "today" | "week" | "month" | "all";
type CarnetLedgerTransaction = {
  id: string;
  createdAt: string;
  description: string;
  amount: number;
  kind: "debt" | "payment";
};

type LedgerOrderItem = {
  name: string;
  quantity: number;
  unitPriceMad: number;
};
const VENDOR_SOUNDS_STORAGE_KEY = "bzaf.vendorSoundsEnabled";
const OTP_WEBHOOK_URL = "https://n8n.srv961724.hstgr.cloud/webhook/otpwtss";

const vendorDashboardSearchSchema = z.object({
  tab: fallback(z.enum(["live", "inventory", "flash-sales", "carnet", "history"]), "live").default("live"),
  sub: fallback(z.enum(["new", "preparing", "ready"]), "new").default("new"),
});

type VendorDashboardSearch = z.infer<typeof vendorDashboardSearchSchema>;

type DashboardOrder = {
  id: string;
  customerName: string;
  customerPhone: string;
  deliveryNotes: string;
  paymentMethod: "COD" | "Carnet";
  status: "new" | "preparing" | "ready" | "delivering" | "delivered";
  deliveryFeeMad: number;
  totalMad: number;
  vendorShareMad: number;
  itemCount: number;
  items: Array<{ name: string; quantity: number; unitPriceMad: number; imageUrl?: string | null }>;
  createdAt: string;
};

type InventoryItem = {
  id: string;
  name: string;
  category?: "Vegetables" | "Fruits" | "Dairy" | "Bakery" | "Pantry";
  measurementUnit: "Kg" | "Liter" | "Piece" | "Pack";
  imageUrl?: string | null;
  vendorPrice: number;
  isAvailable: boolean;
  isFlashSale: boolean;
  flashSalePrice: number | null;
  flashSaleEndTime: string | null;
};

export const Route = createFileRoute("/vendor/dashboard")({
  validateSearch: zodValidator(vendorDashboardSearchSchema),
  head: () => ({
    meta: [
      { title: "Vendor Dashboard | Bzaf Fresh" },
      {
        name: "description",
        content: "Vendor operations dashboard for live order fulfillment and inventory control.",
      },
    ],
  }),
  component: VendorDashboardPage,
});

function VendorDashboardPage() {
  const navigate = useNavigate({ from: "/vendor/dashboard" });
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(true);
  const [kpiFilter, setKpiFilter] = useState<HistoryFilter>("today");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("today");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [inventoryDraft, setInventoryDraft] = useState<
    Record<string, { vendorPrice: string; isAvailable: boolean }>
  >({});
  const [flashDraft, setFlashDraft] = useState<Record<string, { enabled: boolean; price: string; endAt: string }>>({});
  const [isSavingInventoryFor, setIsSavingInventoryFor] = useState<string | null>(null);
  const [isSavingFlashFor, setIsSavingFlashFor] = useState<string | null>(null);
  const [trustedCustomerPhone, setTrustedCustomerPhone] = useState("");
  const [trustedCustomerMaxLimit, setTrustedCustomerMaxLimit] = useState("");
  const [trustedCustomerName, setTrustedCustomerName] = useState("");
  const [trustedCustomerCin, setTrustedCustomerCin] = useState("");
  const [existingCustomerLookup, setExistingCustomerLookup] = useState<{
    found: boolean;
    fullName: string | null;
  } | null>(null);
  const [phoneForPendingCarnetVerification, setPhoneForPendingCarnetVerification] = useState<string | null>(null);
  const [otpCodeForCarnetVerification, setOtpCodeForCarnetVerification] = useState("");
  const [isCarnetOtpModalOpen, setIsCarnetOtpModalOpen] = useState(false);
  const [pendingCarnetPayload, setPendingCarnetPayload] = useState<{
    customerPhone: string;
    maxLimit: number;
    customerName?: string;
    customerCin: string;
  } | null>(null);
  const [isSavingCarnet, setIsSavingCarnet] = useState(false);
  const [selectedCarnetPhone, setSelectedCarnetPhone] = useState<string | null>(null);
  const [ledgerPaymentAmount, setLedgerPaymentAmount] = useState("");
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [expandedLedgerOrderIds, setExpandedLedgerOrderIds] = useState<Record<string, boolean>>({});
  const [rejectedOrderIds, setRejectedOrderIds] = useState<Record<string, boolean>>({});
  const [timeTick, setTimeTick] = useState(Date.now());
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [hasAudioPermissionHintShown, setHasAudioPermissionHintShown] = useState(false);
  const [printOrder, setPrintOrder] = useState<DashboardOrder | null>(null);
  const receiptPrintRef = useRef<HTMLDivElement | null>(null);

  const fetchDashboardData = useServerFn(getVendorDashboardData);
  const fetchInvoiceSettings = useServerFn(getInvoiceSettings);
  const fetchInventoryData = useServerFn(getVendorInventoryData);
  const saveInventoryItem = useServerFn(upsertVendorInventoryItem);
  const saveFlashSale = useServerFn(updateVendorFlashSale);
  const updateStatus = useServerFn(updateVendorOrderStatus);
  const fetchVendorCarnetData = useServerFn(getVendorCarnetData);
  const fetchCarnetLedger = useServerFn(getCarnetCustomerLedger);
  const lookupCustomer = useServerFn(lookupCustomerByPhone);
  const requestOtp = useServerFn(createOtpRequest);
  const verifyAndAddTrustedCustomer = useServerFn(verifyAndAddVendorCarnetCustomer);
  const recordCarnetPayment = useServerFn(recordVendorCarnetPayment);

  const mainView: MainView =
    search.tab === "live"
      ? "orders"
      : search.tab === "inventory"
        ? "inventory"
        : search.tab === "flash-sales"
          ? "flashSales"
        : search.tab === "carnet"
          ? "carnet"
          : "history";

  const activeTab: OrderQueueTab = search.sub;

  const setMainView = (view: MainView) => {
    const tab =
      view === "orders"
        ? "live"
        : view === "inventory"
          ? "inventory"
          : view === "flashSales"
            ? "flash-sales"
            : view === "carnet"
              ? "carnet"
              : "history";
    navigate({
      search: (prev: VendorDashboardSearch) => ({
        ...prev,
        tab,
      }),
      replace: true,
    });
  };

  const setActiveTab = (tab: OrderQueueTab) => {
    navigate({
      search: (prev: VendorDashboardSearch) => ({
        ...prev,
        tab: "live",
        sub: tab,
      }),
      replace: true,
    });
  };

  const dashboardQuery = useQuery({
    queryKey: ["vendor", "dashboard"],
    queryFn: () => fetchDashboardData(),
    refetchInterval: 4_000,
    placeholderData: (previousData) => previousData,
  });

  const invoiceSettingsQuery = useQuery({
    queryKey: ["vendor", "invoice-settings"],
    queryFn: () => fetchInvoiceSettings(),
    staleTime: 60_000,
  });

  const inventoryQuery = useQuery({
    queryKey: ["vendor", "inventory"],
    queryFn: () => fetchInventoryData(),
    placeholderData: (previousData) => previousData,
  });

  const carnetQuery = useQuery({
    queryKey: ["vendor", "carnet"],
    queryFn: () => fetchVendorCarnetData(),
    refetchInterval: 5_000,
    placeholderData: (previousData) => previousData,
  });

  const ledgerQuery = useQuery({
    queryKey: ["vendor", "carnet", "ledger", selectedCarnetPhone],
    queryFn: () => fetchCarnetLedger({ data: { customerPhone: selectedCarnetPhone! } }),
    enabled: !!selectedCarnetPhone,
  });

  const isDashboardInitialLoading = dashboardQuery.isLoading && !dashboardQuery.data;
  const isInventoryInitialLoading = inventoryQuery.isLoading && !inventoryQuery.data;
  const isCarnetInitialLoading = carnetQuery.isLoading && !carnetQuery.data;
  const isLedgerInitialLoading = ledgerQuery.isLoading && !ledgerQuery.data;

  useEffect(() => {
    const channel = supabase
      .channel("vendor-dashboard-orders-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          queryClient.setQueryData(["vendor", "dashboard"], (current: any) => {
            if (!current || !Array.isArray(current.orders)) {
              return current;
            }

            const eventType = payload.eventType;
            const nextOrders = [...current.orders];

            if (eventType === "INSERT") {
              const inserted = payload.new as any;
              if (inserted?.vendor_id !== current.vendor?.id) {
                return current;
              }
              if (!inserted?.id || nextOrders.some((order) => order?.id === inserted.id)) {
                return current;
              }

              nextOrders.unshift(inserted);
            }

            if (eventType === "UPDATE") {
              const updated = payload.new as any;
              if (updated?.vendor_id !== current.vendor?.id) {
                return current;
              }
              if (!updated?.id) {
                return current;
              }

              const index = nextOrders.findIndex((order) => order?.id === updated.id);
              if (index === -1) {
                return current;
              }

              nextOrders[index] = {
                ...nextOrders[index],
                ...updated,
              };
            }

            if (eventType === "DELETE") {
              const deleted = payload.old as any;
              if (deleted?.vendor_id !== current.vendor?.id) {
                return current;
              }
              if (!deleted?.id) {
                return current;
              }

              const filtered = nextOrders.filter((order) => order?.id !== deleted.id);
              if (filtered.length === nextOrders.length) {
                return current;
              }

              return {
                ...current,
                orders: filtered,
              };
            }

            nextOrders.sort((a, b) => {
              const aTime = new Date(a?.created_at ?? 0).getTime();
              const bTime = new Date(b?.created_at ?? 0).getTime();
              return bTime - aTime;
            });

            return {
              ...current,
              orders: nextOrders,
            };
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    const timer = window.setInterval(() => setTimeTick(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const vendorStoreName =
    dashboardQuery.data?.vendor?.storeName ?? inventoryQuery.data?.vendor?.store_name ?? "Vendor Store";

  const normalizedTrustedCustomerPhone = useMemo(
    () => normalizeMoroccoPhoneInput(trustedCustomerPhone),
    [trustedCustomerPhone],
  );
  const trustedCustomerFullPhone = useMemo(
    () => formatMoroccoPhoneForPayload(normalizedTrustedCustomerPhone),
    [normalizedTrustedCustomerPhone],
  );
  const isTrustedCustomerPhoneValid = useMemo(
    () => isValidMoroccoPhone(normalizedTrustedCustomerPhone),
    [normalizedTrustedCustomerPhone],
  );

  useEffect(() => {
    if (!isTrustedCustomerPhoneValid) {
      setExistingCustomerLookup(null);
      return;
    }

    let cancelled = false;
    const lookupTimer = window.setTimeout(async () => {
      try {
        const result = await lookupCustomer({ data: { customerPhone: trustedCustomerFullPhone } });
        if (cancelled) {
          return;
        }

        if (result.found) {
          setExistingCustomerLookup({
            found: true,
            fullName: result.customer?.fullName ?? null,
          });
          setTrustedCustomerName(result.customer?.fullName ?? "");
          return;
        }

        setExistingCustomerLookup({ found: false, fullName: null });
      } catch (error) {
        console.error("Customer phone lookup failed:", error);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(lookupTimer);
    };
  }, [isTrustedCustomerPhoneValid, lookupCustomer, trustedCustomerFullPhone]);

  const orders = useMemo<DashboardOrder[]>(() => {
    const rows = dashboardQuery.data?.orders ?? [];
    return rows
      .map((row) => ({
        id: row.id,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        deliveryNotes: row.delivery_notes,
        paymentMethod: row.payment_method,
        status: row.status,
        deliveryFeeMad: Number(row.delivery_fee ?? 0),
        totalMad: Number(row.total_price ?? 0),
        vendorShareMad: Math.max(Number(row.total_price ?? 0) - Number(row.delivery_fee ?? 0), 0),
        itemCount: Number(row.item_count ?? 0),
        items: Array.isArray(row.order_items) ? row.order_items : [],
        createdAt: row.created_at,
      }))
      .filter((order) => !rejectedOrderIds[order.id]);
  }, [dashboardQuery.data, rejectedOrderIds]);

  const queue = useMemo(
    () => ({
      new: orders.filter((order) => order.status === "new"),
      preparing: orders.filter((order) => order.status === "preparing"),
      ready: orders.filter((order) => order.status === "ready"),
      delivered: orders.filter((order) => order.status === "delivered"),
    }),
    [orders],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsSoundEnabled(localStorage.getItem(VENDOR_SOUNDS_STORAGE_KEY) === "1");
  }, []);

  const previousNewOrderIdsRef = useRef<Set<string>>(new Set());
  const hasInitializedNewOrdersRef = useRef(false);

  useEffect(() => {
    const currentNewOrderIds = new Set(queue.new.map((order) => order.id));

    if (!hasInitializedNewOrdersRef.current) {
      previousNewOrderIdsRef.current.clear();
      currentNewOrderIds.forEach((id) => previousNewOrderIdsRef.current.add(id));
      hasInitializedNewOrdersRef.current = true;
      return;
    }

    const hasIncomingNewOrder = Array.from(currentNewOrderIds).some((id) => !previousNewOrderIdsRef.current.has(id));
    previousNewOrderIdsRef.current.clear();
    currentNewOrderIds.forEach((id) => previousNewOrderIdsRef.current.add(id));

    if (!hasIncomingNewOrder || !isSoundEnabled) {
      return;
    }

    void playAlertSound({ enabled: true }).then((played) => {
      if (!played && !hasAudioPermissionHintShown) {
        toast.info("Click the sound icon to allow alerts in your browser.");
        setHasAudioPermissionHintShown(true);
      }
    });
  }, [queue.new, isSoundEnabled, hasAudioPermissionHintShown]);

  const handleToggleSounds = async () => {
    const nextEnabled = !isSoundEnabled;
    setIsSoundEnabled(nextEnabled);

    if (typeof window !== "undefined") {
      localStorage.setItem(VENDOR_SOUNDS_STORAGE_KEY, nextEnabled ? "1" : "0");
    }

    if (!nextEnabled) {
      toast.success("Sounds disabled.");
      return;
    }

    const played = await playAlertSound({ enabled: true });
    if (!played) {
      toast.error("Browser blocked autoplay. Tap again after interacting with the page.");
      return;
    }

    toast.success("Sounds enabled.");
  };

  const quickStats = useMemo(() => {
    const now = new Date();
    const inKpiWindow = (createdAt: string) => {
      const date = new Date(createdAt);
      if (Number.isNaN(date.getTime())) {
        return false;
      }

      if (kpiFilter === "all") {
        return true;
      }

      if (kpiFilter === "today") {
        return date.toDateString() === now.toDateString();
      }

      if (kpiFilter === "week") {
        const startOfWeek = new Date(now);
        const dayOffset = (startOfWeek.getDay() + 6) % 7;
        startOfWeek.setDate(startOfWeek.getDate() - dayOffset);
        startOfWeek.setHours(0, 0, 0, 0);
        return date >= startOfWeek && date <= now;
      }

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);
      return date >= startOfMonth && date <= now;
    };

    const pendingOrders = queue.new.length + queue.preparing.length;
    const deliveredInFilter = orders.filter(
      (order) =>
        order.status === "delivered" &&
        inKpiWindow(order.createdAt),
    );
    const cashOrders = deliveredInFilter.filter((order) => order.paymentMethod === "COD");
    const carnetOrders = deliveredInFilter.filter((order) => order.paymentMethod === "Carnet");
    const outstandingCreditMad = (carnetQuery.data?.carnetCustomers ?? []).reduce(
      (sum, customer) => sum + Number(customer.currentDebt ?? 0),
      0,
    );

    return {
      pendingOrders,
      completedInFilter: deliveredInFilter.length,
      cashEarningsMad: cashOrders.reduce((sum, order) => sum + Number(order.vendorShareMad ?? 0), 0),
      creditIssuedMad: carnetOrders.reduce((sum, order) => sum + Number(order.vendorShareMad ?? 0), 0),
      outstandingCreditMad,
    };
  }, [orders, queue, kpiFilter, carnetQuery.data?.carnetCustomers]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );
  const printableOrder = useMemo<ThermalReceiptOrder>(
    () =>
      printOrder
        ? {
            id: printOrder.id,
            customerName: printOrder.customerName,
            customerPhone: printOrder.customerPhone,
            createdAt: printOrder.createdAt,
            items: printOrder.items,
            deliveryFeeMad: Number(printOrder.deliveryFeeMad ?? 0),
            totalMad: printOrder.totalMad,
          }
        : {
            id: "preview",
            customerName: "-",
            customerPhone: "-",
            createdAt: new Date().toISOString(),
            items: [],
            deliveryFeeMad: 0,
            totalMad: 0,
          },
    [printOrder],
  );
  const printableSettings = useMemo<ThermalInvoiceSettings>(
    () => ({
      storeName: invoiceSettingsQuery.data?.store_name ?? "Store",
      address: invoiceSettingsQuery.data?.address ?? "",
      phone: invoiceSettingsQuery.data?.phone ?? "",
      taxId: invoiceSettingsQuery.data?.tax_id ?? null,
      footerMessage: invoiceSettingsQuery.data?.footer_message ?? "Thank you!",
    }),
    [invoiceSettingsQuery.data],
  );
  const handlePrintReceipt = useReactToPrint({
    contentRef: receiptPrintRef,
    documentTitle: printOrder ? `receipt-${printOrder.id.slice(0, 8)}` : "thermal-receipt",
    onAfterPrint: () => {
      setPrintOrder(null);
    },
    onPrintError: () => {
      setPrintOrder(null);
      toast.error("Failed to open printer dialog.");
    },
  });

  useEffect(() => {
    if (!printOrder || !invoiceSettingsQuery.data) {
      return;
    }

    const timer = window.setTimeout(() => {
      const receiptNode = receiptPrintRef.current;
      if (!receiptNode || !receiptNode.textContent?.trim()) {
        toast.error("Receipt is not ready yet. Please try again.");
        setPrintOrder(null);
        return;
      }

      void handlePrintReceipt();
    }, 140);

    return () => window.clearTimeout(timer);
  }, [handlePrintReceipt, invoiceSettingsQuery.data, printOrder]);
  const selectedCarnetCustomer = useMemo(
    () =>
      (carnetQuery.data?.carnetCustomers ?? []).find(
        (customer) => customer.customerPhone === selectedCarnetPhone,
      ) ?? null,
    [carnetQuery.data?.carnetCustomers, selectedCarnetPhone],
  );
  const ledgerTransactions = useMemo<CarnetLedgerTransaction[]>(
    () => (ledgerQuery.data?.transactions ?? []) as CarnetLedgerTransaction[],
    [ledgerQuery.data?.transactions],
  );

  const ordersById = useMemo(() => {
    return new Map(orders.map((order) => [order.id, order]));
  }, [orders]);

  const inventoryItems = useMemo<InventoryItem[]>(
    () =>
      ((inventoryQuery.data?.products ?? []) as Array<{
        id: string;
        name: string;
        category?: "Vegetables" | "Fruits" | "Dairy" | "Bakery" | "Pantry";
        measurementUnit: "Kg" | "Liter" | "Piece" | "Pack";
        imageUrl?: string | null;
        vendorPrice: number;
        isAvailable: boolean;
        isFlashSale?: boolean;
        flashSalePrice?: number | null;
        flashSaleEndTime?: string | null;
      }>).map((item) => ({
        ...item,
        isFlashSale: item.isFlashSale ?? false,
        flashSalePrice: item.flashSalePrice ?? null,
        flashSaleEndTime: item.flashSaleEndTime ?? null,
      })),
    [inventoryQuery.data],
  );

  useEffect(() => {
    if (inventoryItems.length === 0) {
      return;
    }

    setInventoryDraft((current) => {
      const next = { ...current };
      for (const item of inventoryItems) {
        next[item.id] = {
          vendorPrice: current[item.id]?.vendorPrice ?? (item.vendorPrice > 0 ? String(item.vendorPrice) : ""),
          isAvailable: current[item.id]?.isAvailable ?? item.isAvailable,
        };
      }
      return next;
    });

    setFlashDraft((current) => {
      const next = { ...current };
      for (const item of inventoryItems) {
        next[item.id] = {
          enabled: current[item.id]?.enabled ?? item.isFlashSale,
          price:
            current[item.id]?.price ??
            (item.flashSalePrice != null ? String(item.flashSalePrice) : item.vendorPrice > 0 ? String(item.vendorPrice) : ""),
          endAt: current[item.id]?.endAt ?? (item.flashSaleEndTime ?? ""),
        };
      }
      return next;
    });
  }, [inventoryItems]);

  const handleAcceptOrder = async (orderId: string) => {
    try {
      setIsUpdating(orderId);
      queryClient.setQueryData(["vendor", "dashboard"], (current: any) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          orders: (current.orders ?? []).map((order: any) =>
            order.id === orderId ? { ...order, status: "preparing" } : order,
          ),
        };
      });

      await updateStatus({ data: { orderId, nextStatus: "preparing" } });
      await dashboardQuery.refetch();
      toast.success("Order moved to preparing.");
    } catch (error) {
      console.error("Failed to accept order:", error);
      await dashboardQuery.refetch();
      toast.error("Failed to update order status.");
    } finally {
      setIsUpdating(null);
    }
  };

  const handleMarkReady = async (orderId: string) => {
    try {
      setIsUpdating(orderId);
      const orderForReceipt = orders.find((order) => order.id === orderId) ?? null;
      queryClient.setQueryData(["vendor", "dashboard"], (current: any) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          orders: (current.orders ?? []).map((order: any) =>
            order.id === orderId ? { ...order, status: "ready" } : order,
          ),
        };
      });

      await updateStatus({ data: { orderId, nextStatus: "ready" } });
      await dashboardQuery.refetch();
      toast.success("Order marked as ready.");

      if (orderForReceipt) {
        setPrintOrder({
          ...orderForReceipt,
          status: "ready",
        });
      }
    } catch (error) {
      console.error("Failed to mark order as ready:", error);
      await dashboardQuery.refetch();
      toast.error("Failed to update order status.");
    } finally {
      setIsUpdating(null);
    }
  };

  const handleRejectOrder = (orderId: string) => {
    setRejectedOrderIds((current) => ({
      ...current,
      [orderId]: true,
    }));
    toast.success("Order removed from your active queue.");
  };

  const persistInventoryItem = async (item: InventoryItem, vendorPrice: number, isAvailable: boolean) => {
    try {
      setIsSavingInventoryFor(item.id);
      await saveInventoryItem({
        data: {
          masterProductId: item.id,
          vendorPrice,
          isAvailable,
        },
      });
      await inventoryQuery.refetch();
      toast.success("Inventory updated.");
    } catch (error) {
      console.error("Failed to save inventory item:", error);
      toast.error("Failed to save inventory item.");
    } finally {
      setIsSavingInventoryFor(null);
    }
  };

  const handleSaveInventoryItem = async (item: InventoryItem) => {
    const draft = inventoryDraft[item.id] ?? {
      vendorPrice: item.vendorPrice > 0 ? String(item.vendorPrice) : "",
      isAvailable: item.isAvailable,
    };

    const numericPrice = Number(draft.vendorPrice);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      toast.error("Please enter a valid price.");
      return;
    }

    await persistInventoryItem(item, numericPrice, draft.isAvailable);
  };

  const handleToggleAvailability = async (item: InventoryItem, checked: boolean) => {
    setInventoryDraft((current) => ({
      ...current,
      [item.id]: {
        ...(current[item.id] ?? {
          vendorPrice: item.vendorPrice > 0 ? String(item.vendorPrice) : "",
          isAvailable: item.isAvailable,
        }),
        isAvailable: checked,
      },
    }));

    const draftPrice = inventoryDraft[item.id]?.vendorPrice ?? (item.vendorPrice > 0 ? String(item.vendorPrice) : "0");
    const numericPrice = Number(draftPrice);

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      toast.error("Set a valid price before changing stock status.");
      return;
    }

    await persistInventoryItem(item, numericPrice, checked);
  };

  const handleSaveFlashSale = async (item: InventoryItem) => {
    const draft = flashDraft[item.id] ?? {
      enabled: item.isFlashSale,
      price: item.flashSalePrice != null ? String(item.flashSalePrice) : "",
      endAt: item.flashSaleEndTime ?? "",
    };

    const numericFlashPrice = Number(draft.price);
    if (draft.enabled) {
      if (Number.isNaN(numericFlashPrice) || numericFlashPrice <= 0) {
        toast.error("Flash sale price must be greater than 0.");
        return;
      }

      if (numericFlashPrice >= item.vendorPrice) {
        toast.error("Flash sale price must be lower than your regular price.");
        return;
      }

      if (!draft.endAt) {
        toast.error("Please choose when the flash sale ends.");
        return;
      }

      const endTime = new Date(draft.endAt);
      if (Number.isNaN(endTime.getTime()) || endTime.getTime() <= Date.now()) {
        toast.error("Flash sale end time must be in the future.");
        return;
      }
    }

    try {
      setIsSavingFlashFor(item.id);
      await saveFlashSale({
        data: {
          masterProductId: item.id,
          enabled: draft.enabled,
          flashSalePrice: draft.enabled ? numericFlashPrice : null,
          flashSaleEndTime: draft.enabled ? new Date(draft.endAt).toISOString() : null,
        },
      });
      await inventoryQuery.refetch();
      toast.success(draft.enabled ? "Flash sale saved." : "Flash sale disabled.");
    } catch (error) {
      console.error("Failed to save flash sale:", error);
      toast.error("Failed to save flash sale.");
    } finally {
      setIsSavingFlashFor(null);
    }
  };

  const handleLogout = async () => {
    clearRoleSessions();
    toast.success("Logged out successfully.");
    await navigate({ to: "/vendor/login" });
  };

  return (
    <main className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <Store className="size-5" />
                </span>
                <div>
                  <h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">{vendorStoreName}</h1>
                  <p className="text-xs text-muted-foreground sm:text-sm">Vendor Operations Dashboard</p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  size="icon"
                  variant="soft"
                  className="rounded-xl"
                  onClick={handleToggleSounds}
                  aria-label={isSoundEnabled ? "Disable Sounds" : "Enable Sounds"}
                  title={isSoundEnabled ? "Disable Sounds" : "Enable Sounds"}
                >
                  {isSoundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                </Button>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 shadow-sm">
                  <span className="text-xs text-muted-foreground sm:text-sm">{isOnline ? "Online" : "Offline"}</span>
                  <Switch checked={isOnline} onCheckedChange={setIsOnline} />
                </div>
                <Button variant="soft" className="rounded-xl" onClick={handleLogout}>
                  <LogOut className="size-4" />
                  Logout
                </Button>
                <Button variant="soft" className="rounded-xl" onClick={() => navigate({ to: "/vendor/wallet" })}>
                  <Wallet className="size-4" />
                  Wallet
                </Button>
              </div>
            </div>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-xs font-medium text-muted-foreground">KPI Period</span>
                <select
                  value={kpiFilter}
                  onChange={(event) => setKpiFilter(event.target.value as HistoryFilter)}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-xs outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                >
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="all">All Time</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <QuickStatCard label="Pending Orders" value={String(quickStats.pendingOrders)} icon={Clock3} />
              <QuickStatCard
                label="Cash Sales Volume · مبيعات نقداً"
                value={`${quickStats.cashEarningsMad.toFixed(2)} MAD`}
                tone="accent"
                icon={Banknote}
              />
              <QuickStatCard
                label="Credit Issued · مبيعات الكارني"
                value={`${quickStats.creditIssuedMad.toFixed(2)} MAD`}
                icon={BookUser}
              />
              <QuickStatCard
                label="Outstanding Credit"
                value={`${quickStats.outstandingCreditMad.toFixed(2)} MAD`}
                icon={History}
              />
              </div>
            </section>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl p-4 md:p-6">
        <ViewSwitcherMobile value={mainView} onChange={setMainView} />

        <div className="mt-4 grid gap-6 md:mt-0 md:grid-cols-[240px_minmax(0,1fr)] md:gap-6">
          <aside className="hidden md:block">
            <div className="sticky top-36 space-y-1 rounded-2xl border border-border bg-card p-2 shadow-sm">
              <ViewNavButton
                label="Live Orders"
                icon={ShoppingBag}
                active={mainView === "orders"}
                onClick={() => setMainView("orders")}
              />
              <ViewNavButton
                label="Store Inventory"
                icon={Package}
                active={mainView === "inventory"}
                onClick={() => setMainView("inventory")}
              />
              <ViewNavButton
                label="Flash Sales"
                icon={Zap}
                active={mainView === "flashSales"}
                onClick={() => setMainView("flashSales")}
              />
              <ViewNavButton
                label="Carnet (Credit)"
                icon={BookUser}
                active={mainView === "carnet"}
                onClick={() => setMainView("carnet")}
              />
              <ViewNavButton
                label="Order History"
                icon={History}
                active={mainView === "history"}
                onClick={() => setMainView("history")}
              />
            </div>
          </aside>

          <div>
            {mainView === "orders" ? (
              <LiveOrdersView
                activeTab={activeTab}
                onTabChange={setActiveTab}
                queue={queue}
                isLoading={isDashboardInitialLoading}
                isUpdating={isUpdating}
                onOpenOrder={(orderId) => setSelectedOrderId(orderId)}
                onAcceptOrder={handleAcceptOrder}
                onMarkReady={handleMarkReady}
                onRejectOrder={handleRejectOrder}
                timeTick={timeTick}
              />
            ) : mainView === "history" ? (
              <OrderHistoryView
                orders={queue.delivered}
                filter={historyFilter}
                onFilterChange={setHistoryFilter}
              />
            ) : mainView === "carnet" ? (
              <CarnetView
                trustedCustomerPhone={normalizedTrustedCustomerPhone}
                trustedCustomerMaxLimit={trustedCustomerMaxLimit}
                trustedCustomerName={trustedCustomerName}
                trustedCustomerCin={trustedCustomerCin}
                existingCustomerLookup={existingCustomerLookup}
                onPhoneChange={setTrustedCustomerPhone}
                onMaxLimitChange={setTrustedCustomerMaxLimit}
                onNameChange={setTrustedCustomerName}
                onCinChange={setTrustedCustomerCin}
                customers={carnetQuery.data?.carnetCustomers ?? []}
                isLoading={isCarnetInitialLoading}
                isSavingCarnet={isSavingCarnet}
                onOpenLedger={(customerPhone: string) => {
                  setSelectedCarnetPhone(customerPhone);
                  setLedgerPaymentAmount("");
                }}
                onAddTrustedCustomer={async () => {
                  if (!isTrustedCustomerPhoneValid) {
                    toast.error("Enter a valid customer phone number.");
                    return;
                  }

                  const maxLimit = Number(trustedCustomerMaxLimit);
                  if (Number.isNaN(maxLimit) || maxLimit < 0) {
                    toast.error("Enter a valid max credit limit.");
                    return;
                  }

                  if (existingCustomerLookup?.found === false && trustedCustomerName.trim().length === 0) {
                    toast.error("Full name is required for new customers.");
                    return;
                  }

                  if (!/^[A-Za-z0-9-]{4,30}$/.test(trustedCustomerCin.trim())) {
                    toast.error("CIN must be 4-30 letters, numbers, or hyphens.");
                    return;
                  }

                  const existingInCarnet = (carnetQuery.data?.carnetCustomers ?? []).some(
                    (customer) => customer.customerPhone === trustedCustomerFullPhone,
                  );
                  if (existingInCarnet) {
                    toast.error("This customer is already in your carnet list.");
                    return;
                  }

                  try {
                    setIsSavingCarnet(true);

                    const otpPayload = await requestOtp({
                      data: { phoneNumber: trustedCustomerFullPhone },
                    });

                    fetch(OTP_WEBHOOK_URL, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        phoneNumber: otpPayload.phoneNumber,
                        otpCode: otpPayload.otpCode,
                      }),
                    }).catch((error) => {
                      console.error("Vendor carnet OTP webhook trigger failed:", error);
                    });

                    setPendingCarnetPayload({
                      customerPhone: trustedCustomerFullPhone,
                      maxLimit,
                      customerName:
                        existingCustomerLookup?.found === true
                          ? existingCustomerLookup.fullName ?? undefined
                          : trustedCustomerName.trim() || undefined,
                      customerCin: trustedCustomerCin.trim(),
                    });
                    setPhoneForPendingCarnetVerification(trustedCustomerFullPhone);
                    setOtpCodeForCarnetVerification("");
                    setIsCarnetOtpModalOpen(true);
                    toast.success("Verification code sent to customer WhatsApp.");
                  } catch (error) {
                    console.error("Failed to save trusted customer:", error);
                    toast.error("Unable to send verification code right now.");
                  } finally {
                    setIsSavingCarnet(false);
                  }
                }}
              />
            ) : mainView === "flashSales" ? (
              <FlashSalesView
                items={inventoryItems}
                drafts={flashDraft}
                isLoading={isInventoryInitialLoading}
                isSavingFlashFor={isSavingFlashFor}
                onDraftChange={setFlashDraft}
                onSaveFlash={handleSaveFlashSale}
              />
            ) : (
              <StoreInventoryView
                items={inventoryItems}
                drafts={inventoryDraft}
                isLoading={isInventoryInitialLoading}
                isSavingInventoryFor={isSavingInventoryFor}
                onDraftChange={setInventoryDraft}
                onSave={handleSaveInventoryItem}
                onQuickToggle={handleToggleAvailability}
              />
            )}
          </div>
        </div>
      </section>

      <Dialog open={isCarnetOtpModalOpen} onOpenChange={setIsCarnetOtpModalOpen}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl border border-border bg-card">
          <DialogHeader>
            <DialogTitle>Confirm WhatsApp Verification</DialogTitle>
            <DialogDescription>
              Averification code has been sent to the customer&apos;s WhatsApp. Enter it below to
              confirm opening their credit account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {phoneForPendingCarnetVerification ? (
              <p className="text-xs text-muted-foreground">Customer: {phoneForPendingCarnetVerification}</p>
            ) : null}

            <Input
              inputMode="numeric"
              maxLength={4}
              placeholder="4-digit code"
              value={otpCodeForCarnetVerification}
              onChange={(event) =>
                setOtpCodeForCarnetVerification(event.target.value.replace(/\D/g, "").slice(0, 4))
              }
              className="h-10 rounded-xl"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setIsCarnetOtpModalOpen(false);
                setOtpCodeForCarnetVerification("");
              }}
              disabled={isSavingCarnet}
            >
              Cancel
            </Button>
            <Button
              variant="hero"
              className="rounded-xl"
              disabled={otpCodeForCarnetVerification.length !== 4 || isSavingCarnet || !pendingCarnetPayload}
              onClick={async () => {
                if (!pendingCarnetPayload) {
                  return;
                }

                try {
                  setIsSavingCarnet(true);
                  const result = await verifyAndAddTrustedCustomer({
                    data: {
                      customerPhone: pendingCarnetPayload.customerPhone,
                      maxLimit: pendingCarnetPayload.maxLimit,
                      customerName: pendingCarnetPayload.customerName,
                      customerCin: pendingCarnetPayload.customerCin,
                      otpCode: otpCodeForCarnetVerification,
                    },
                  });

                  if (!result.verified) {
                    toast.error("Invalid verification code.");
                    return;
                  }

                  setTrustedCustomerPhone("");
                  setTrustedCustomerMaxLimit("");
                  setTrustedCustomerName("");
                  setTrustedCustomerCin("");
                  setExistingCustomerLookup(null);
                  setPendingCarnetPayload(null);
                  setPhoneForPendingCarnetVerification(null);
                  setOtpCodeForCarnetVerification("");
                  setIsCarnetOtpModalOpen(false);
                  await carnetQuery.refetch();
                  toast.success("Trusted customer added to carnet.");
                } catch (error) {
                  console.error("Failed to verify and save trusted customer:", error);
                  toast.error(error instanceof Error ? error.message : "Failed to verify trusted customer.");
                } finally {
                  setIsSavingCarnet(false);
                }
              }}
            >
              {isSavingCarnet ? "Verifying..." : "Verify & Add to Carnet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedOrder !== null}
        onOpenChange={(isOpen) => setSelectedOrderId(isOpen ? selectedOrderId : null)}
      >
        <DialogContent className="w-[95vw] max-w-lg rounded-2xl border border-border bg-card">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>{selectedOrder ? `Order #${shortOrderId(selectedOrder.id)}` : ""}</DialogDescription>
          </DialogHeader>

          {selectedOrder ? (
            <div className="space-y-3">
              <div className="space-y-1 rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-sm text-muted-foreground">Customer</p>
                <p className="text-sm font-medium text-foreground">{selectedOrder.customerName}</p>
                <p className="text-xs text-muted-foreground">{selectedOrder.customerPhone}</p>
                {selectedOrder.deliveryNotes ? (
                  <p className="text-xs text-muted-foreground">{selectedOrder.deliveryNotes}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                {selectedOrder.items.map((item, index) => (
                  <div
                    key={`${selectedOrder.id}-${index}`}
                    className="flex items-center justify-between rounded-xl border border-border p-3"
                  >
                    <p className="text-sm text-foreground">
                      {item.quantity}x {item.name}
                    </p>
                    <p className="text-sm font-semibold text-foreground">{item.quantity * item.unitPriceMad} MAD</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-border pt-2">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-base font-semibold text-foreground">{selectedOrder.totalMad} MAD</p>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" className="w-full rounded-xl" onClick={() => setSelectedOrderId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div aria-hidden="true" className="pointer-events-none fixed -left-[9999px] top-0">
        <ThermalReceipt ref={receiptPrintRef} order={printableOrder} settings={printableSettings} />
      </div>

      <Dialog
        open={selectedCarnetPhone !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedCarnetPhone(null);
            setLedgerPaymentAmount("");
            setExpandedLedgerOrderIds({});
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-4xl rounded-2xl border border-border bg-card">
          <DialogHeader>
            <DialogTitle>Customer Ledger</DialogTitle>
            <DialogDescription>
              Detailed credit ledger with all carnet orders and payment events.
            </DialogDescription>
          </DialogHeader>

          {selectedCarnetCustomer ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-muted/20 p-3 md:grid-cols-2 xl:grid-cols-5">
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="text-sm font-medium text-foreground">{selectedCarnetCustomer.customerName ?? "Unnamed Customer"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium text-foreground">{selectedCarnetCustomer.customerPhone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CIN</p>
                  <p className="text-sm font-medium text-foreground">{selectedCarnetCustomer.customerCin ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current Debt</p>
                  <p className="text-sm font-semibold text-destructive">{selectedCarnetCustomer.currentDebt.toFixed(2)} MAD</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Max Limit</p>
                  <p className="text-sm font-medium text-foreground">{selectedCarnetCustomer.maxLimit.toFixed(2)} MAD</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-background p-3 md:grid-cols-[240px_auto]">
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Payment amount (MAD)"
                  value={ledgerPaymentAmount}
                  onChange={(event) => setLedgerPaymentAmount(event.target.value)}
                  className="h-10 rounded-xl"
                />
                <Button
                  variant="hero"
                  className="h-10 rounded-xl"
                  disabled={isRecordingPayment}
                  onClick={async () => {
                    const amount = Number(ledgerPaymentAmount);
                    if (Number.isNaN(amount) || amount <= 0) {
                      toast.error("Enter a valid payment amount.");
                      return;
                    }

                    try {
                      setIsRecordingPayment(true);
                      await recordCarnetPayment({
                        data: {
                          customerPhone: selectedCarnetCustomer.customerPhone,
                          amountPaid: amount,
                        },
                      });
                      setLedgerPaymentAmount("");
                      await Promise.all([carnetQuery.refetch(), ledgerQuery.refetch()]);
                      toast.success("Payment recorded successfully.");
                    } catch (error) {
                      console.error("Failed to record payment:", error);
                      toast.error(error instanceof Error ? error.message : "Failed to record payment.");
                    } finally {
                      setIsRecordingPayment(false);
                    }
                  }}
                >
                  {isRecordingPayment ? "Saving..." : "Record Payment"}
                </Button>
              </div>

              {isLedgerInitialLoading ? (
                <EmptyState label="Loading ledger history..." />
              ) : ledgerTransactions.length === 0 ? (
                <EmptyState label="No transactions found for this customer." />
              ) : (
                <div className="max-h-[360px] overflow-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgerTransactions.map((transaction) => {
                        const date = formatOrderDateTime(transaction.createdAt);
                        const orderId = transaction.id.startsWith("order:")
                          ? transaction.id.replace("order:", "")
                          : null;
                        const isOrderRow = transaction.kind === "debt" && !!orderId;
                        const isExpanded = !!(orderId && expandedLedgerOrderIds[orderId]);
                        const orderItems = orderId
                          ? (((ordersById.get(orderId)?.items ?? []) as LedgerOrderItem[]).map((item) => ({
                              name: item.name,
                              quantity: Number(item.quantity ?? 0),
                              unitPriceMad: Number(item.unitPriceMad ?? 0),
                            })) as LedgerOrderItem[])
                          : [];
                        const orderDeliveryFeeMad = orderId ? Number(ordersById.get(orderId)?.deliveryFeeMad ?? 0) : 0;

                        return (
                          <Fragment key={transaction.id}>
                            <TableRow
                              className={isOrderRow ? "cursor-pointer" : undefined}
                              onClick={
                                isOrderRow && orderId
                                  ? () => {
                                      setExpandedLedgerOrderIds((prev) => ({
                                        ...prev,
                                        [orderId]: !prev[orderId],
                                      }));
                                    }
                                  : undefined
                              }
                            >
                              <TableCell className="text-xs text-muted-foreground">
                                {date.date} • {date.time}
                              </TableCell>
                              <TableCell className="font-medium text-foreground">
                                <div className="flex items-center gap-2">
                                  {isOrderRow ? (
                                    <ChevronDown
                                      className={`size-4 text-muted-foreground transition-transform duration-200 ${
                                        isExpanded ? "rotate-180" : ""
                                      }`}
                                    />
                                  ) : null}
                                  <span>{transaction.description}</span>
                                </div>
                              </TableCell>
                              <TableCell
                                className={`text-right font-semibold ${
                                  transaction.kind === "debt" ? "text-destructive" : "text-success"
                                }`}
                              >
                                {transaction.kind === "debt" ? "+" : "-"}
                                {Number(transaction.amount ?? 0).toFixed(2)} MAD
                              </TableCell>
                            </TableRow>

                            {isOrderRow && orderId ? (
                              <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={3} className="pt-0">
                                  <div
                                    className={`overflow-hidden transition-all duration-300 ${
                                      isExpanded ? "max-h-64 opacity-100 py-2" : "max-h-0 opacity-0"
                                    }`}
                                  >
                                    <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                                      {orderItems.length > 0 ? (
                                        <div className="space-y-2">
                                          {orderItems.map((item, itemIndex) => (
                                            <div
                                              key={`${transaction.id}-item-${itemIndex}`}
                                              className="flex items-start justify-between gap-3 border-b border-border/50 py-2 last:border-b-0"
                                            >
                                              <div className="min-w-0">
                                                <p className="truncate font-medium text-foreground">
                                                  {item.quantity}x {item.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                  Unit: {item.unitPriceMad.toFixed(2)} MAD
                                                </p>
                                              </div>
                                              <p className="shrink-0 font-semibold text-foreground">
                                                {(item.quantity * item.unitPriceMad).toFixed(2)} MAD
                                              </p>
                                            </div>
                                          ))}

                                          <div className="border-t border-gray-200 my-2" />

                                          <div className="flex items-center justify-between gap-3 py-1">
                                            <p className="text-gray-500 text-sm">
                                              Delivery Fee (Paid to Cyclist) / رسوم التوصيل
                                            </p>
                                            <p className="shrink-0 font-semibold text-foreground">
                                              {orderDeliveryFeeMad.toFixed(2)} MAD
                                            </p>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          <p>No item details available for this order.</p>
                                          <div className="border-t border-gray-200 my-2" />
                                          <div className="flex items-center justify-between gap-3 py-1">
                                            <p className="text-gray-500 text-sm">
                                              Delivery Fee (Paid to Cyclist) / رسوم التوصيل
                                            </p>
                                            <p className="shrink-0 font-semibold text-foreground">
                                              {orderDeliveryFeeMad.toFixed(2)} MAD
                                            </p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <EmptyState label="Customer not found." />
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function ViewSwitcherMobile({ value, onChange }: { value: MainView; onChange: (view: MainView) => void }) {
  return (
    <div className="md:hidden">
      <div className="grid w-full grid-cols-4 items-center gap-1 rounded-2xl border border-border bg-card p-1 shadow-sm">
        <Button
          type="button"
          variant={value === "orders" ? "default" : "ghost"}
          className="h-10 rounded-xl"
          onClick={() => onChange("orders")}
        >
          <ShoppingBag className="size-4" />
          Live Orders
        </Button>
        <Button
          type="button"
          variant={value === "history" ? "default" : "ghost"}
          className="h-10 rounded-xl"
          onClick={() => onChange("history")}
        >
          <History className="size-4" />
          History
        </Button>
        <Button
          type="button"
          variant={value === "inventory" ? "default" : "ghost"}
          className="h-10 rounded-xl"
          onClick={() => onChange("inventory")}
        >
          <Boxes className="size-4" />
          Store Inventory
        </Button>
        <Button
          type="button"
          variant={value === "flashSales" ? "default" : "ghost"}
          className="h-10 rounded-xl"
          onClick={() => onChange("flashSales")}
        >
          <Zap className="size-4" />
          Flash Sales
        </Button>
      </div>
    </div>
  );
}

function ViewNavButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof ShoppingBag;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-xl border-r-4 px-3 py-2.5 text-sm transition-colors ${
        active
          ? "border-primary bg-primary/10 font-semibold text-primary"
          : "border-transparent bg-transparent font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function LiveOrdersView({
  activeTab,
  onTabChange,
  queue,
  isLoading,
  isUpdating,
  onOpenOrder,
  onAcceptOrder,
  onMarkReady,
  onRejectOrder,
  timeTick,
}: {
  activeTab: OrderQueueTab;
  onTabChange: (tab: OrderQueueTab) => void;
  queue: { new: DashboardOrder[]; preparing: DashboardOrder[]; ready: DashboardOrder[]; delivered: DashboardOrder[] };
  isLoading: boolean;
  isUpdating: string | null;
  onOpenOrder: (orderId: string) => void;
  onAcceptOrder: (orderId: string) => void;
  onMarkReady: (orderId: string) => void;
  onRejectOrder: (orderId: string) => void;
  timeTick: number;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Live Orders</h2>
          <p className="text-xs text-muted-foreground">Manage urgent orders by operational stage.</p>
        </div>
        {isLoading ? <span className="text-sm text-muted-foreground">Loading...</span> : null}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => (v === "new" || v === "preparing" || v === "ready" ? onTabChange(v) : undefined)}
      >
        <TabsList className="h-11 w-full justify-start gap-1 overflow-x-auto rounded-xl">
          <TabsTrigger value="new" className="rounded-lg">
            New ({queue.new.length})
          </TabsTrigger>
          <TabsTrigger value="preparing" className="rounded-lg">
            Preparing ({queue.preparing.length})
          </TabsTrigger>
          <TabsTrigger value="ready" className="rounded-lg">
            Ready ({queue.ready.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-4">
          {isLoading ? (
            <EmptyState label="Loading live orders..." />
          ) : queue.new.length === 0 ? (
            <EmptyState label="No new orders right now." />
          ) : (
            <div className="max-h-[calc(100vh-300px)] overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {queue.new.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    tab="new"
                    isUpdating={isUpdating === order.id}
                    onOpenDetails={() => onOpenOrder(order.id)}
                    onAccept={() => onAcceptOrder(order.id)}
                    onReject={() => onRejectOrder(order.id)}
                    timeTick={timeTick}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="preparing" className="mt-4">
          {isLoading ? (
            <EmptyState label="Loading live orders..." />
          ) : queue.preparing.length === 0 ? (
            <EmptyState label="No orders are currently being prepared." />
          ) : (
            <div className="max-h-[calc(100vh-300px)] overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {queue.preparing.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    tab="preparing"
                    isUpdating={isUpdating === order.id}
                    onOpenDetails={() => onOpenOrder(order.id)}
                    onMarkReady={() => onMarkReady(order.id)}
                    timeTick={timeTick}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="ready" className="mt-4">
          {isLoading ? (
            <EmptyState label="Loading live orders..." />
          ) : queue.ready.length === 0 ? (
            <EmptyState label="No orders waiting for pickup." />
          ) : (
            <div className="max-h-[calc(100vh-300px)] overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {queue.ready.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    tab="ready"
                    isUpdating={false}
                    onOpenDetails={() => onOpenOrder(order.id)}
                    timeTick={timeTick}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

      </Tabs>
    </section>
  );
}

function OrderHistoryView({
  orders,
  filter,
  onFilterChange,
}: {
  orders: DashboardOrder[];
  filter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
}) {
  const filteredOrders = useMemo(() => {
    const now = new Date();

    return orders.filter((order) => {
      const createdAt = new Date(order.createdAt);
      if (Number.isNaN(createdAt.getTime())) {
        return false;
      }

      if (filter === "all") {
        return true;
      }

      if (filter === "today") {
        return createdAt.toDateString() === now.toDateString();
      }

      if (filter === "week") {
        const startOfWeek = new Date(now);
        const dayOffset = (startOfWeek.getDay() + 6) % 7;
        startOfWeek.setDate(startOfWeek.getDate() - dayOffset);
        startOfWeek.setHours(0, 0, 0, 0);
        return createdAt >= startOfWeek && createdAt <= now;
      }

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);
      return createdAt >= startOfMonth && createdAt <= now;
    });
  }, [orders, filter]);

  const summary = useMemo(
    () => ({
      completedOrders: filteredOrders.length,
      totalEarningsMad: filteredOrders.reduce((sum, order) => sum + Number(order.totalMad ?? 0), 0),
    }),
    [filteredOrders],
  );

  const filterOptions: Array<{ value: HistoryFilter; label: string }> = [
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "all", label: "All Time" },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Order History</h2>
          <p className="text-xs text-muted-foreground">Delivered orders and revenue reporting.</p>
        </div>

        <div className="inline-flex items-center rounded-xl border border-border bg-background p-1">
          {filterOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={filter === option.value ? "default" : "ghost"}
              className="h-8 rounded-lg px-3 text-xs"
              onClick={() => onFilterChange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <QuickStatCard label="Total Earnings (MAD)" value={`${summary.totalEarningsMad.toFixed(2)} MAD`} icon={Banknote} tone="accent" />
        <QuickStatCard label="Completed Orders" value={String(summary.completedOrders)} icon={CheckCircle2} />
      </div>

      {filteredOrders.length === 0 ? (
        <EmptyState label="No delivered orders found for this period." />
      ) : (
        <div className="max-h-[calc(100vh-300px)] overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                tab="ready"
                compact
                isUpdating={false}
                onOpenDetails={() => {}}
                timeTick={Date.now()}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CarnetView({
  trustedCustomerPhone,
  trustedCustomerMaxLimit,
  trustedCustomerName,
  trustedCustomerCin,
  existingCustomerLookup,
  onPhoneChange,
  onMaxLimitChange,
  onNameChange,
  onCinChange,
  customers,
  isLoading,
  isSavingCarnet,
  onOpenLedger,
  onAddTrustedCustomer,
}: {
  trustedCustomerPhone: string;
  trustedCustomerMaxLimit: string;
  trustedCustomerName: string;
  trustedCustomerCin: string;
  existingCustomerLookup: { found: boolean; fullName: string | null } | null;
  onPhoneChange: (value: string) => void;
  onMaxLimitChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onCinChange: (value: string) => void;
  customers: Array<{
    id: string;
    customerPhone: string;
    currentDebt: number;
    maxLimit: number;
    customerName?: string | null;
    customerCin?: string | null;
    status?: string;
  }>;
  isLoading: boolean;
  isSavingCarnet: boolean;
  onOpenLedger: (customerPhone: string) => void;
  onAddTrustedCustomer: () => Promise<void>;
}) {
  const showNewCustomerFields = existingCustomerLookup?.found === false;

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">Carnet (Credit)</h2>
        <p className="text-xs text-muted-foreground">Manage trusted customers and their credit balances.</p>
      </div>

      <div className="mb-4 space-y-3 rounded-xl border border-border bg-background p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <div className="flex items-center overflow-hidden rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
            <span className="px-3 text-sm font-medium text-muted-foreground">+212</span>
            <Input
              placeholder="6XXXXXXXX"
              inputMode="numeric"
              value={trustedCustomerPhone}
              onChange={(event) => onPhoneChange(normalizeMoroccoPhoneInput(event.target.value))}
              className="h-10 border-0 rounded-none shadow-none focus-visible:ring-0"
            />
          </div>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="Max limit (MAD)"
            value={trustedCustomerMaxLimit}
            onChange={(event) => onMaxLimitChange(event.target.value)}
            className="h-10 rounded-xl"
          />
          <Button variant="hero" className="h-10 rounded-xl" onClick={onAddTrustedCustomer} disabled={isSavingCarnet}>
            {isSavingCarnet ? "Sending..." : "Verify & Add to Carnet"}
          </Button>
        </div>

        {existingCustomerLookup ? (
          existingCustomerLookup.found ? (
            <Badge className="w-fit rounded-lg bg-emerald-500/10 text-emerald-700 border-emerald-200">
              Existing Customer: {existingCustomerLookup.fullName ?? "Unnamed Customer"}
            </Badge>
          ) : (
            <Badge variant="secondary" className="w-fit rounded-lg">
              New Customer
            </Badge>
          )
        ) : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {showNewCustomerFields ? (
            <Input
              placeholder="Full Name *"
              value={trustedCustomerName}
              onChange={(event) => onNameChange(event.target.value)}
              className="h-10 rounded-xl"
            />
          ) : (
            <div className="hidden md:block" />
          )}
          <Input
            placeholder="CIN / National ID *"
            value={trustedCustomerCin}
            onChange={(event) => onCinChange(event.target.value.toUpperCase())}
            className="h-10 rounded-xl"
          />
        </div>
      </div>

      {isLoading ? (
        <EmptyState label="Loading carnet customers..." />
      ) : customers.length === 0 ? (
        <EmptyState label="No trusted customers added yet." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[1.2fr_1fr_1fr] items-center gap-2 bg-muted/30 px-3 py-2 text-xs font-semibold text-muted-foreground">
            <span>Phone</span>
            <span>Current Debt</span>
            <span>Max Limit</span>
          </div>
          <div className="divide-y divide-border">
            {customers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => onOpenLedger(customer.customerPhone)}
                className="grid w-full grid-cols-[1.2fr_1fr_1fr] items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-muted/40"
              >
                <p className="font-medium text-primary underline-offset-2 hover:underline">{customer.customerPhone}</p>
                <p className="text-foreground">{customer.currentDebt.toFixed(2)} MAD</p>
                <p className="text-foreground">{customer.maxLimit.toFixed(2)} MAD</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function StoreInventoryView({
  items,
  drafts,
  isLoading,
  isSavingInventoryFor,
  onDraftChange,
  onSave,
  onQuickToggle,
}: {
  items: InventoryItem[];
  drafts: Record<string, { vendorPrice: string; isAvailable: boolean }>;
  isLoading: boolean;
  isSavingInventoryFor: string | null;
  onDraftChange: Dispatch<SetStateAction<Record<string, { vendorPrice: string; isAvailable: boolean }>>>;
  onSave: (item: InventoryItem) => Promise<void>;
  onQuickToggle: (item: InventoryItem, checked: boolean) => Promise<void>;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "in-stock" | "out-of-stock" | "unpriced">("all");

  const categoryOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort(),
    [items],
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();

    return items.filter((item) => {
      const draft = drafts[item.id] ?? {
        vendorPrice: item.vendorPrice > 0 ? String(item.vendorPrice) : "",
        isAvailable: item.isAvailable,
      };

      const parsedDraftPrice = Number(draft.vendorPrice);
      const effectivePrice = Number.isNaN(parsedDraftPrice) ? 0 : parsedDraftPrice;

      const matchesSearch = !normalizedQuery || item.name.toLowerCase().includes(normalizedQuery);
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "in-stock"
            ? draft.isAvailable
            : statusFilter === "out-of-stock"
              ? !draft.isAvailable
              : effectivePrice <= 0;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, drafts, searchTerm, categoryFilter, statusFilter]);

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">Store Inventory</h2>
        <p className="text-xs text-muted-foreground">Set your live prices and control product availability instantly.</p>
      </div>

      {isLoading ? (
        <EmptyState label="Loading inventory..." />
      ) : items.length === 0 ? (
        <EmptyState label="No master products available yet." />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-border bg-background p-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search products by name"
                className="h-10 rounded-xl pl-9"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
            >
              <option value="all">All Categories</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "in-stock" | "out-of-stock" | "unpriced")}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
            >
              <option value="all">All</option>
              <option value="in-stock">In Stock</option>
              <option value="out-of-stock">Out of Stock</option>
              <option value="unpriced">Unpriced</option>
            </select>
          </div>

          <p className="mb-3 text-xs text-muted-foreground">Showing {filteredItems.length} products</p>

          {filteredItems.length === 0 ? (
            <EmptyState label="No products found matching your criteria." />
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {filteredItems.map((item) => {
            const draft = drafts[item.id] ?? {
              vendorPrice: item.vendorPrice > 0 ? String(item.vendorPrice) : "",
              isAvailable: item.isAvailable,
            };

            return (
              <article
                key={item.id}
                className="rounded-2xl border border-border bg-background p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex aspect-square w-14 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">
                      <img
                        src={item.imageUrl || fallbackProductImage}
                        alt={`${item.name} product image`}
                        className="h-full w-full object-contain object-center p-1.5"
                        loading="lazy"
                        width={80}
                        height={80}
                      />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {item.category ? (
                          <Badge variant="outline" className="rounded-md">
                            {item.category}
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className="rounded-md">
                          {item.measurementUnit}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5">
                    <span className="text-xs font-medium text-foreground">
                      {draft.isAvailable ? "In Stock" : "Out of Stock"}
                    </span>
                    <Switch checked={draft.isAvailable} onCheckedChange={(checked) => onQuickToggle(item, checked)} />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Your Price (MAD)</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.vendorPrice}
                      onChange={(event) =>
                        onDraftChange((current) => ({
                          ...current,
                          [item.id]: {
                            ...(current[item.id] ?? {
                              vendorPrice: item.vendorPrice > 0 ? String(item.vendorPrice) : "",
                              isAvailable: item.isAvailable,
                            }),
                            vendorPrice: event.target.value,
                          },
                        }))
                      }
                      placeholder="0.00"
                      className="h-10 rounded-xl"
                    />
                  </div>

                  <Button
                    variant="hero"
                    className="h-10 rounded-xl sm:min-w-28"
                    onClick={() => onSave(item)}
                    disabled={isSavingInventoryFor === item.id}
                  >
                    {isSavingInventoryFor === item.id ? "Saving..." : "Save"}
                  </Button>
                </div>
              </article>
            );
          })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function FlashSalesView({
  items,
  drafts,
  isLoading,
  isSavingFlashFor,
  onDraftChange,
  onSaveFlash,
}: {
  items: InventoryItem[];
  drafts: Record<string, { enabled: boolean; price: string; endAt: string }>;
  isLoading: boolean;
  isSavingFlashFor: string | null;
  onDraftChange: Dispatch<SetStateAction<Record<string, { enabled: boolean; price: string; endAt: string }>>>;
  onSaveFlash: (item: InventoryItem) => Promise<void>;
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      if (!item.isAvailable || item.vendorPrice <= 0) {
        return false;
      }
      return !normalizedQuery || item.name.toLowerCase().includes(normalizedQuery);
    });
  }, [items, searchTerm]);

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">Flash Sales</h2>
        <p className="text-xs text-muted-foreground">Enable limited-time deals to boost conversions.</p>
      </div>

      {isLoading ? (
        <EmptyState label="Loading flash sale products..." />
      ) : filteredItems.length === 0 ? (
        <EmptyState label="No in-stock priced products available for flash sales." />
      ) : (
        <>
          <div className="mb-4 rounded-xl border border-border bg-background p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search products by name"
                className="h-10 rounded-xl pl-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filteredItems.map((item) => {
              const draft = drafts[item.id] ?? {
                enabled: item.isFlashSale,
                price: item.flashSalePrice != null ? String(item.flashSalePrice) : "",
                endAt: item.flashSaleEndTime ?? "",
              };

              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-border bg-background p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex aspect-square w-14 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">
                        <img
                          src={item.imageUrl || fallbackProductImage}
                          alt={`${item.name} product image`}
                          className="h-full w-full object-contain object-center p-1.5"
                          loading="lazy"
                          width={80}
                          height={80}
                        />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Regular: {item.vendorPrice.toFixed(2)} MAD</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5">
                      <span className="text-xs font-medium text-foreground">{draft.enabled ? "Active" : "Inactive"}</span>
                      <Switch
                        checked={draft.enabled}
                        onCheckedChange={(checked) =>
                          onDraftChange((current) => ({
                            ...current,
                            [item.id]: {
                              ...(current[item.id] ?? {
                                enabled: item.isFlashSale,
                                price: item.flashSalePrice != null ? String(item.flashSalePrice) : "",
                                endAt: item.flashSaleEndTime ?? "",
                              }),
                              enabled: checked,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Flash Price (MAD)</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.price}
                        onChange={(event) =>
                          onDraftChange((current) => ({
                            ...current,
                            [item.id]: {
                              ...(current[item.id] ?? {
                                enabled: item.isFlashSale,
                                price: item.flashSalePrice != null ? String(item.flashSalePrice) : "",
                                endAt: item.flashSaleEndTime ?? "",
                              }),
                              price: event.target.value,
                            },
                          }))
                        }
                        placeholder="0.00"
                        className="h-10 rounded-xl"
                        disabled={!draft.enabled}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Ends At</label>
                      <Input
                        type="datetime-local"
                        value={draft.endAt ? new Date(draft.endAt).toISOString().slice(0, 16) : ""}
                        onChange={(event) =>
                          onDraftChange((current) => ({
                            ...current,
                            [item.id]: {
                              ...(current[item.id] ?? {
                                enabled: item.isFlashSale,
                                price: item.flashSalePrice != null ? String(item.flashSalePrice) : "",
                                endAt: item.flashSaleEndTime ?? "",
                              }),
                              endAt: event.target.value ? new Date(event.target.value).toISOString() : "",
                            },
                          }))
                        }
                        className="h-10 rounded-xl"
                        disabled={!draft.enabled}
                      />
                    </div>
                  </div>

                  <Button
                    variant="hero"
                    className="mt-3 h-10 w-full rounded-xl"
                    onClick={() => onSaveFlash(item)}
                    disabled={isSavingFlashFor === item.id}
                  >
                    {isSavingFlashFor === item.id ? "Saving..." : "Save Flash Sale"}
                  </Button>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function OrderCard({
  order,
  tab,
  compact = false,
  isUpdating,
  onOpenDetails,
  onAccept,
  onReject,
  onMarkReady,
  timeTick,
}: {
  order: DashboardOrder;
  tab: OrderQueueTab;
  compact?: boolean;
  isUpdating: boolean;
  onOpenDetails?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onMarkReady?: () => void;
  timeTick: number;
}) {
  const orderTitle = `Order #${shortOrderId(order.id)}`;
  const elapsed = elapsedLabel(order.createdAt, timeTick);
  const dateAndTime = formatOrderDateTime(order.createdAt);
  const [checkedItemKeys, setCheckedItemKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCheckedItemKeys((current) => {
      const next: Record<string, boolean> = {};
      order.items.forEach((item, index) => {
        const key = getOrderItemKey(order.id, item, index);
        next[key] = current[key] ?? false;
      });
      return next;
    });
  }, [order.id, order.items]);

  const packedCount =
    tab === "preparing"
      ? order.items.filter((item, index) => checkedItemKeys[getOrderItemKey(order.id, item, index)]).length
      : 0;
  const allPacked = tab === "preparing" ? order.items.length > 0 && packedCount === order.items.length : false;
  const whatsappUrl = `https://wa.me/${order.customerPhone.replace("+", "")}`;

  return (
    <article
      className={`rounded-2xl border border-border bg-background shadow-sm transition hover:shadow-md ${
        compact ? "p-3" : "p-4"
      }`}
    >
      {onOpenDetails ? (
        <button type="button" onClick={onOpenDetails} className="w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-foreground">{orderTitle}</p>
              {!compact ? (
                <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  {tab === "new" ? <span className="inline-block size-2 rounded-full bg-accent animate-pulse" /> : null}
                  <Clock3 className="size-3.5" />
                  {elapsed}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  {dateAndTime.date} • {dateAndTime.time}
                </p>
              )}
            </div>

            {compact ? (
              <Badge className="rounded-md bg-success/15 text-success hover:bg-success/15">Delivered</Badge>
            ) : (
              <OrderStatusBadge tab={tab} status={order.status} />
            )}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1">
              {!compact ? (
                <>
                  <p className="text-xs text-muted-foreground">Items</p>
                  <p className="text-sm text-foreground">{order.itemCount} items</p>
                </>
              ) : null}
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-semibold text-foreground">{order.totalMad.toFixed(2)} MAD</p>
            </div>
          </div>
        </button>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-foreground">{orderTitle}</p>
            {!compact ? (
              <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                {tab === "new" ? <span className="inline-block size-2 rounded-full bg-accent animate-pulse" /> : null}
                <Clock3 className="size-3.5" />
                {elapsed}
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                {dateAndTime.date} • {dateAndTime.time}
              </p>
            )}
          </div>

          {compact ? (
            <Badge className="rounded-md bg-success/15 text-success hover:bg-success/15">Delivered</Badge>
          ) : (
            <OrderStatusBadge tab={tab} status={order.status} />
          )}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1">
            {!compact ? (
              <>
                <p className="text-xs text-muted-foreground">Items</p>
                <p className="text-sm text-foreground">{order.itemCount} items</p>
              </>
            ) : null}
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-semibold text-foreground">{order.totalMad.toFixed(2)} MAD</p>
          </div>
          </div>
        </>
      )}

      {!compact ? (
        <div className="mt-4 rounded-xl border border-border bg-muted/20 p-3">
        <p className="text-xs text-muted-foreground">Customer</p>
        <p className="mt-1 text-sm font-medium text-foreground">{order.customerName}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <a
            href={`tel:${order.customerPhone}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
            aria-label={`Call ${order.customerName}`}
          >
            <Phone className="size-3.5" />
            {order.customerPhone}
          </a>

          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg px-2.5 text-xs">
                <MessageCircle className="size-3.5" />
                WhatsApp
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 rounded-xl border-border bg-card p-3">
              <div className="space-y-2 text-center">
                <p className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                  <QrCode className="size-3.5" />
                  WhatsApp QR
                </p>
                <div className="mx-auto inline-flex rounded-lg border border-border bg-background p-2">
                  <QRCodeSVG value={whatsappUrl} size={144} />
                </div>
                <p className="text-[11px] text-muted-foreground">Scan to open chat on your phone.</p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        </div>
      ) : null}

       {!compact && (tab === "new" || tab === "preparing") && order.items.length > 0 ? (
        <div className="mt-4 space-y-2 rounded-xl border border-border bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {tab === "preparing" ? "Packing Checklist" : "Order Items"}
          </p>
          {order.items.map((item, index) => {
            const itemKey = getOrderItemKey(order.id, item, index);
            const isChecked = checkedItemKeys[itemKey] ?? false;

            return (
              <label
                key={itemKey}
                className={`flex items-center justify-between gap-3 rounded-lg border border-border px-2.5 py-2 ${
                  tab === "preparing" && isChecked ? "bg-muted/40" : "bg-background"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {tab === "preparing" ? (
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        setCheckedItemKeys((current) => ({
                          ...current,
                          [itemKey]: checked === true,
                        }));
                      }}
                      aria-label={`Mark ${item.name} as packed`}
                    />
                  ) : null}

                  <span
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40 ${
                      tab === "preparing" && isChecked ? "opacity-50" : "opacity-100"
                    }`}
                  >
                    <img
                      src={item.imageUrl || fallbackProductImage}
                      alt={`${item.name} thumbnail`}
                      className="h-full w-full object-contain p-1"
                      loading="lazy"
                      width={40}
                      height={40}
                    />
                  </span>

                  <p
                    className={`min-w-0 text-sm text-foreground ${
                      tab === "preparing" && isChecked ? "line-through opacity-70" : ""
                    }`}
                  >
                    {item.quantity}x {item.name}
                  </p>
                </div>

                <p className="shrink-0 text-xs font-medium text-muted-foreground">
                  {(item.quantity * item.unitPriceMad).toFixed(2)} MAD
                </p>
              </label>
            );
          })}

          {tab === "preparing" ? (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-medium text-muted-foreground">
                Packed: {packedCount}/{order.items.length} items
              </p>
              <Progress value={(packedCount / order.items.length) * 100} className="h-1.5" />
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "new" ? (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button variant="hero" className="h-10 w-full rounded-xl" onClick={onAccept} disabled={isUpdating}>
            <BadgeCheck className="size-4" />
            {isUpdating ? "Updating..." : "Accept & Prepare"}
          </Button>
          <Button variant="outline" className="h-10 w-full rounded-xl" onClick={onReject} disabled={isUpdating}>
            Reject
          </Button>
        </div>
      ) : null}

      {tab === "preparing" ? (
        <Button
          variant="hero"
          className="mt-4 h-10 w-full rounded-xl"
          onClick={onMarkReady}
          disabled={isUpdating || !allPacked}
        >
          <Truck className="size-4" />
          {isUpdating ? "Updating..." : "Ready for Pickup"}
        </Button>
      ) : null}
    </article>
  );
}

function QuickStatCard({
  label,
  value,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: "default" | "accent";
  icon: typeof Clock3;
}) {
  return (
    <article
      className={`rounded-xl border px-3 py-2 shadow-sm ${
        tone === "accent"
          ? "border-primary/20 bg-primary/5 text-foreground"
          : "border-border bg-card text-foreground"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-extrabold text-foreground">{value}</p>
        </div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
          <Icon className="size-4" />
        </span>
      </div>
    </article>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <AppEmptyState title={label} subtitle="Data will appear here as soon as it becomes available." />
  );
}

function OrderStatusBadge({ tab, status }: { tab: OrderQueueTab; status: DashboardOrder["status"] }) {
  if (tab === "new") {
    return <Badge className="rounded-md bg-accent/15 text-accent-foreground hover:bg-accent/15">New</Badge>;
  }

  if (tab === "preparing") {
    return <Badge className="rounded-md bg-primary/15 text-primary hover:bg-primary/15">Preparing</Badge>;
  }

  return status === "ready" ? (
    <Badge className="rounded-md bg-success/15 text-success hover:bg-success/15">Ready</Badge>
  ) : (
    <Badge className="rounded-md bg-primary/15 text-primary hover:bg-primary/15">Active</Badge>
  );
}

function shortOrderId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function getOrderItemKey(
  orderId: string,
  item: { name: string; quantity: number; unitPriceMad: number },
  index: number,
) {
  return `${orderId}:${item.name}:${item.quantity}:${item.unitPriceMad}:${index}`;
}

function elapsedLabel(createdAt: string, nowTick: number) {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) {
    return "--";
  }

  const minutes = Math.max(0, Math.floor((nowTick - created) / 60000));
  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatOrderDateTime(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return { date: "--", time: "--" };
  }

  return {
    date: date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function summarizeItems(items: Array<{ name: string; quantity: number; unitPriceMad: number }>) {
  if (!items.length) {
    return "No items";
  }

  const names = items.slice(0, 2).map((item) => item.name);
  return items.length > 2 ? `${names.join(", ")}...` : names.join(", ");
}
