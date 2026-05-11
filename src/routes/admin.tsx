import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type Dispatch,
  type DragEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  LayoutDashboard,
  PackageCheck,
  Store,
  Boxes,
  Settings,
  TrendingUp,
  MapPin,
  CircleDollarSign,
  Phone,
  User,
  ImagePlus,
  Bike,
  TriangleAlert,
  Megaphone,
  Shapes,
  ChevronsUpDown,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { EmptyState as AppEmptyState } from "@/components/ui/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  type MasterProductEntity,
} from "@/lib/entities";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatMoroccoPhoneForPayload,
  isValidMoroccoPhone,
  normalizeMoroccoPhoneInput,
} from "@/lib/morocco-phone";
import {
  createCommune,
  createNeighborhood,
  listServiceZones,
  updateCommune,
  updateNeighborhood,
  type ServiceZoneTree,
} from "@/lib/locations.functions";
import {
  archiveMasterProduct,
  createMasterProduct,
  listMasterProducts,
  uploadMasterProductImage,
  updateMasterProduct,
  type MeasurementUnit,
} from "@/lib/catalog.functions";
import {
  createCategory,
  listAdminCategories,
  updateCategory,
} from "@/lib/categories.functions";
import {
  createAnnouncement,
  createSiteAd,
  deleteAnnouncement,
  deleteSiteAd,
  listAnnouncements,
  listSiteAds,
  updateAnnouncement,
  updateSiteAd,
} from "@/lib/ads-content.functions";
import { checkAdminDatabaseHealth } from "@/lib/admin-health.functions";
import {
  createVendor,
  getVendorSalesAnalytics,
  listVendors,
  type AdminVendorRecord,
  type VendorSalesAnalytics,
  updateVendorActiveState,
  updateVendorDetails,
} from "@/lib/vendors.functions";
import {
  createCyclist,
  listCyclists,
  type AdminCyclistRecord,
} from "@/lib/cyclists.functions";
import {
  getAdminOverviewAnalytics,
  getGlobalSettings,
  listAdminCustomers,
  listAdminOrders,
  updateGlobalSettings,
} from "@/lib/admin-dashboard.functions";
import { getAdminInvoiceSettings, updateAdminInvoiceSettings } from "@/lib/admin-dashboard.functions";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import fallbackProductImage from "@/assets/product-vegetables.jpg";
import { CATEGORY_ICON_OPTIONS, CategoryIcon, type CategoryIconName } from "@/lib/lucide-category-icons";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type AdminTab =
  | "overview"
  | "orders"
  | "customers"
  | "vendors"
  | "cyclists"
  | "service-zones"
  | "catalog"
  | "categories"
  | "ads-content"
  | "settings";

const navItems: Array<{ label: string; tab: AdminTab; icon: ComponentType<{ className?: string }> }> = [
  { label: "Overview", tab: "overview", icon: LayoutDashboard },
  { label: "Orders", tab: "orders", icon: PackageCheck },
  { label: "Customers العملاء", tab: "customers", icon: Users },
  { label: "Vendors", tab: "vendors", icon: Store },
  { label: "Cyclists", tab: "cyclists", icon: Bike },
  { label: "Service Zones", tab: "service-zones", icon: MapPin },
  { label: "Global Catalog", tab: "catalog", icon: Boxes },
  { label: "Categories", tab: "categories", icon: Shapes },
  { label: "Ads & Content", tab: "ads-content", icon: Megaphone },
  { label: "Settings", tab: "settings", icon: Settings },
];

const initialVendors: AdminVendorRecord[] = [];
const initialCyclists: AdminCyclistRecord[] = [];
const emptyVendorAnalytics: VendorSalesAnalytics = {
  todaysRevenueMad: 0,
  totalAllTimeSalesMad: 0,
  totalCompletedOrders: 0,
  lastFiveOrders: [],
};

const initialMasterProducts: MasterProductEntity[] = [];
type CategoryAdminRow = {
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
const initialCategories: CategoryAdminRow[] = [];
const initialAdminOrders: Array<{
  id: string;
  createdAt: string;
  vendorName: string;
  customerPhone: string;
  totalPrice: number;
  status: "new" | "preparing" | "ready" | "delivering" | "delivered" | "cancelled";
}> = [];
const measurementUnits: MeasurementUnit[] = ["Kg", "Liter", "Piece", "Pack"];
const masterProductFormSchema = z.object({
  name: z.string().trim().min(1),
  nameFr: z.string().trim().min(1),
  nameAr: z.string().trim().min(1),
  categoryId: z.string().uuid(),
  measurementUnit: z.enum(["Kg", "Liter", "Piece", "Pack"]),
  popularityScore: z.number().int().min(0).max(1_000_000),
});

const weeklyOrdersChartConfig = {
  orders: {
    label: "Orders",
    color: "oklch(0.72 0.14 157)",
  },
} satisfies ChartConfig;

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>) => {
    const tab = typeof search.tab === "string" ? search.tab : "overview";
    if (
      [
        "overview",
        "orders",
        "customers",
        "vendors",
        "cyclists",
        "service-zones",
        "catalog",
        "categories",
        "ads-content",
        "settings",
      ].includes(tab)
    ) {
      return { tab: tab as AdminTab };
    }
    return { tab: "overview" as AdminTab };
  },
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Super Admin Dashboard — Bzaf Fresh" },
      {
        name: "description",
        content:
          "Super-admin command center for orders, vendors, and global catalog operations across the marketplace.",
      },
    ],
  }),
});

function AdminPage() {
  const { t } = useTranslation();
  const { tab } = Route.useSearch();
  const queryClient = useQueryClient();
  const fetchVendors = useServerFn(listVendors);
  const fetchCyclists = useServerFn(listCyclists);
  const saveCyclistToDatabase = useServerFn(createCyclist);
  const saveVendorToDatabase = useServerFn(createVendor);
  const saveVendorDetails = useServerFn(updateVendorDetails);
  const setVendorActiveState = useServerFn(updateVendorActiveState);
  const fetchVendorSalesAnalytics = useServerFn(getVendorSalesAnalytics);
  const fetchServiceZones = useServerFn(listServiceZones);
  const saveCommune = useServerFn(createCommune);
  const saveNeighborhood = useServerFn(createNeighborhood);
  const editCommune = useServerFn(updateCommune);
  const editNeighborhood = useServerFn(updateNeighborhood);
  const fetchMasterProducts = useServerFn(listMasterProducts);
  const fetchCategories = useServerFn(listAdminCategories);
  const fetchSiteAds = useServerFn(listSiteAds);
  const fetchAnnouncements = useServerFn(listAnnouncements);
  const fetchAdminOverviewAnalytics = useServerFn(getAdminOverviewAnalytics);
  const fetchGlobalSettings = useServerFn(getGlobalSettings);
  const saveGlobalSettingsToDatabase = useServerFn(updateGlobalSettings);
  const fetchAdminOrders = useServerFn(listAdminOrders);
  const fetchAdminCustomers = useServerFn(listAdminCustomers);
  const fetchAdminInvoiceSettings = useServerFn(getAdminInvoiceSettings);
  const saveAdminInvoiceSettings = useServerFn(updateAdminInvoiceSettings);
  const fetchDatabaseHealth = useServerFn(checkAdminDatabaseHealth);
  const saveMasterProductToDatabase = useServerFn(createMasterProduct);
  const uploadMasterProductImageToStorage = useServerFn(uploadMasterProductImage);
  const updateMasterProductInDatabase = useServerFn(updateMasterProduct);
  const archiveMasterProductInDatabase = useServerFn(archiveMasterProduct);
  const createCategoryInDatabase = useServerFn(createCategory);
  const updateCategoryInDatabase = useServerFn(updateCategory);
  const createSiteAdInDatabase = useServerFn(createSiteAd);
  const updateSiteAdInDatabase = useServerFn(updateSiteAd);
  const deleteSiteAdInDatabase = useServerFn(deleteSiteAd);
  const createAnnouncementInDatabase = useServerFn(createAnnouncement);
  const updateAnnouncementInDatabase = useServerFn(updateAnnouncement);
  const deleteAnnouncementInDatabase = useServerFn(deleteAnnouncement);
  const dbHealthQuery = useQuery({
    queryKey: ["admin", "database-health"],
    queryFn: () => fetchDatabaseHealth(),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const isAdminDataEnabled = dbHealthQuery.data?.healthy ?? false;
  const vendorsQuery = useQuery({
    queryKey: ["admin", "vendors"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchVendors(),
  });
  const serviceZonesQuery = useQuery({
    queryKey: ["admin", "service-zones"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchServiceZones(),
  });
  const cyclistsQuery = useQuery({
    queryKey: ["admin", "cyclists"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchCyclists(),
  });
  const masterProductsQuery = useQuery({
    queryKey: ["admin", "master-products"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchMasterProducts(),
  });
  const siteAdsQuery = useQuery({
    queryKey: ["admin", "site-ads"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchSiteAds(),
  });
  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchCategories(),
  });
  const announcementsQuery = useQuery({
    queryKey: ["admin", "announcements"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchAnnouncements(),
  });
  const overviewAnalyticsQuery = useQuery({
    queryKey: ["admin", "overview-analytics"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchAdminOverviewAnalytics(),
    refetchInterval: 15_000,
  });
  const adminOrdersQuery = useQuery({
    queryKey: ["admin", "orders-global"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchAdminOrders(),
    refetchInterval: 10_000,
  });
  const adminCustomersQuery = useQuery({
    queryKey: ["admin", "customers"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchAdminCustomers(),
    refetchInterval: 20_000,
  });
  const adminInvoiceSettingsQuery = useQuery({
    queryKey: ["admin", "invoice-settings"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchAdminInvoiceSettings(),
  });
  const globalSettingsQuery = useQuery({
    queryKey: ["admin", "global-settings"],
    enabled: isAdminDataEnabled,
    queryFn: () => fetchGlobalSettings(),
  });

  const vendors = vendorsQuery.data ?? initialVendors;
  const cyclists = cyclistsQuery.data ?? initialCyclists;
  const serviceZones = serviceZonesQuery.data ?? [];
  const masterProducts =
    masterProductsQuery.data?.map(
      (row): MasterProductEntity => ({
        id: row.id,
        name: row.product_name,
        nameFr: row.name_fr,
        nameAr: row.name_ar,
        categoryId: row.category_id,
        category: row.category,
        measurementUnit: row.measurement_unit,
        popularityScore: row.popularity_score,
        imageUrl: row.image_url,
        createdAt: row.created_at,
      }),
    ) ?? initialMasterProducts;
  const adminOrders = adminOrdersQuery.data ?? initialAdminOrders;
  const adminCustomers =
    (adminCustomersQuery.data as
      | Array<{
          id: string;
          fullName: string;
          phone: string;
          address: string;
          joinedAt: string;
          totalOrders: number;
          ltvMad: number;
        }>
      | undefined) ?? [];
  const categories = (categoriesQuery.data ?? initialCategories) as CategoryAdminRow[];
  const activeCategories = categories.filter((category) => category.is_active);

  const [isVendorPanelOpen, setIsVendorPanelOpen] = useState(false);
  const [isCyclistPanelOpen, setIsCyclistPanelOpen] = useState(false);
  const [isManageVendorPanelOpen, setIsManageVendorPanelOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSavingAd, setIsSavingAd] = useState(false);
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  const [isUpdatingVendorState, setIsUpdatingVendorState] = useState(false);
  const [isUpdatingVendorDetails, setIsUpdatingVendorDetails] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<AdminVendorRecord | null>(null);
  const [pendingArchiveProduct, setPendingArchiveProduct] = useState<MasterProductEntity | null>(null);

  const [vendorForm, setVendorForm] = useState({
    storeName: "",
    ownerName: "",
    phoneNumber: "",
    communeId: "",
    neighborhoodIds: [] as string[],
    isActive: true,
  });
  const [cyclistForm, setCyclistForm] = useState({
    fullName: "",
    phoneNumber: "",
    communeId: "",
    neighborhoodIds: [] as string[],
    isActive: true,
  });
  const [serviceZoneForm, setServiceZoneForm] = useState({
    communeName: "",
    neighborhoodCommuneId: "",
    neighborhoodName: "",
    neighborhoodDeliveryFee: "0",
  });
  const [isRenamingCommuneId, setIsRenamingCommuneId] = useState<string | null>(null);
  const [isRenamingNeighborhoodId, setIsRenamingNeighborhoodId] = useState<string | null>(null);

  const [productForm, setProductForm] = useState({
    name: "",
    nameFr: "",
    nameAr: "",
    categoryId: "",
    measurementUnit: "Piece" as MeasurementUnit,
    popularityScore: "0",
  });
  const [categoryForm, setCategoryForm] = useState({
    id: "",
    nameEn: "",
    nameFr: "",
    nameAr: "",
    imageUrl: "",
    iconName: "Carrot" as CategoryIconName,
    accentColor: "#f3f4f6",
    sortOrder: "0",
    isActive: true,
  });
  const [categoryImageFile, setCategoryImageFile] = useState<File | null>(null);
  const [categoryImagePreviewUrl, setCategoryImagePreviewUrl] = useState<string | null>(null);
  const categoryImageInputRef = useRef<HTMLInputElement | null>(null);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreviewUrl, setProductImagePreviewUrl] = useState<string | null>(null);
  const [currentProductImageUrl, setCurrentProductImageUrl] = useState<string | null>(null);
  const [isUploadingProduct, setIsUploadingProduct] = useState(false);
  const productImageInputRef = useRef<HTMLInputElement | null>(null);
  const [manageVendorForm, setManageVendorForm] = useState({
    vendorId: "",
    storeName: "",
    ownerName: "",
    phoneNumber: "",
    communeId: "",
    neighborhoodIds: [] as string[],
    isActive: true,
  });
  const [adForm, setAdForm] = useState({
    id: "",
    imageUrl: "",
    linkUrl: "",
    sortOrder: "0",
    isActive: true,
  });
  const [adImageFile, setAdImageFile] = useState<File | null>(null);
  const [adImagePreviewUrl, setAdImagePreviewUrl] = useState<string | null>(null);
  const adImageInputRef = useRef<HTMLInputElement | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    id: "",
    content: "",
    contentFr: "",
    contentAr: "",
    isActive: true,
    bgColor: "#deff9a",
    textColor: "#000000",
  });
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<
    "all" | "new" | "preparing" | "ready" | "delivering" | "delivered"
  >("all");
  const [settingsForm, setSettingsForm] = useState({
    id: "",
    deliveryFeeMad: "10",
    minimumOrderMad: "50",
    freeDeliveryThresholdMad: "500",
    marketplaceActive: true,
  });
  const [isSavingGlobalSettings, setIsSavingGlobalSettings] = useState(false);
  const [receiptForm, setReceiptForm] = useState({
    id: "",
    storeName: "",
    address: "",
    phone: "",
    taxId: "",
    footerMessage: "",
  });
  const [isSavingReceiptSettings, setIsSavingReceiptSettings] = useState(false);

  useEffect(() => {
    const row = globalSettingsQuery.data;
    if (!row?.id) {
      return;
    }

    setSettingsForm((current) => {
      if (current.id === row.id) {
        return current;
      }

      return {
        id: row.id,
        deliveryFeeMad: String(Number(row.global_delivery_fee ?? 10)),
        minimumOrderMad: String(Number(row.minimum_order_amount ?? 50)),
        freeDeliveryThresholdMad: String(Number(row.free_delivery_threshold ?? 500)),
        marketplaceActive: Boolean(row.marketplace_active ?? true),
      };
    });
  }, [globalSettingsQuery.data]);

  useEffect(() => {
    const row = adminInvoiceSettingsQuery.data;
    if (!row?.id) {
      return;
    }

    setReceiptForm((current) => {
      if (current.id === row.id) {
        return current;
      }

      return {
        id: row.id,
        storeName: row.store_name ?? "",
        address: row.address ?? "",
        phone: row.phone ?? "",
        taxId: row.tax_id ?? "",
        footerMessage: row.footer_message ?? "",
      };
    });

  }, [adminInvoiceSettingsQuery.data]);

  const analyticsQuery = useQuery({
    queryKey: ["admin", "vendor-analytics", selectedVendor?.id],
    enabled: Boolean(isManageVendorPanelOpen && selectedVendor?.id),
    queryFn: () => fetchVendorSalesAnalytics({ data: { vendorId: selectedVendor!.id } }),
  });

  const filteredOrders = useMemo(
    () =>
      ordersStatusFilter === "all"
        ? adminOrders
        : adminOrders.filter((order) => order.status === ordersStatusFilter),
    [adminOrders, ordersStatusFilter],
  );

  const communeOptions = serviceZones;
  const neighborhoodOptions = communeOptions.find((commune) => commune.id === vendorForm.communeId)?.neighborhoods ?? [];
  const cyclistNeighborhoodOptions =
    communeOptions.find((commune) => commune.id === cyclistForm.communeId)?.neighborhoods ?? [];

  const addVendorNeighborhoodOptions = neighborhoodOptions.filter((neighborhood) => neighborhood.vendorId == null);

  const selectedVendorId = selectedVendor?.id ?? manageVendorForm.vendorId;
  const manageNeighborhoodOptions =
    communeOptions
      .find((commune) => commune.id === manageVendorForm.communeId)
      ?.neighborhoods.filter(
        (neighborhood) => neighborhood.vendorId == null || neighborhood.vendorId === selectedVendorId,
      ) ?? [];

  const toggleVendorNeighborhood = (neighborhoodId: string, checked: boolean) => {
    setVendorForm((current) => {
      const currentSet = new Set(current.neighborhoodIds);
      if (checked) currentSet.add(neighborhoodId);
      else currentSet.delete(neighborhoodId);

      return {
        ...current,
        neighborhoodIds: Array.from(currentSet),
      };
    });
  };

  const toggleManageVendorNeighborhood = (neighborhoodId: string, checked: boolean) => {
    setManageVendorForm((current) => {
      const currentSet = new Set(current.neighborhoodIds);
      if (checked) currentSet.add(neighborhoodId);
      else currentSet.delete(neighborhoodId);

      return {
        ...current,
        neighborhoodIds: Array.from(currentSet),
      };
    });
  };

  const toggleCyclistNeighborhood = (neighborhoodId: string, checked: boolean) => {
    setCyclistForm((current) => {
      const currentSet = new Set(current.neighborhoodIds);
      if (checked) {
        currentSet.add(neighborhoodId);
      } else {
        currentSet.delete(neighborhoodId);
      }

      return {
        ...current,
        neighborhoodIds: Array.from(currentSet),
      };
    });
  };
  const openManageVendorPanel = (vendor: AdminVendorRecord) => {
    const matchingCommune = serviceZones.find((commune) =>
      commune.neighborhoods.some((neighborhood) => vendor.neighborhoodIds.includes(neighborhood.id)),
    );

    setSelectedVendor(vendor);
    setManageVendorForm({
      vendorId: vendor.id,
      storeName: vendor.storeName,
      ownerName: vendor.ownerName,
      phoneNumber: normalizeMoroccoPhoneInput(vendor.phoneNumber),
      communeId: matchingCommune?.id ?? "",
      neighborhoodIds: vendor.neighborhoodIds,
      isActive: vendor.status === "Active",
    });
    setIsManageVendorPanelOpen(true);
  };

  const handleVendorActiveStateToggle = async (isActive: boolean) => {
    if (!manageVendorForm.vendorId) {
      return;
    }

    setIsUpdatingVendorState(true);
    try {
      await setVendorActiveState({
        data: {
          vendorId: manageVendorForm.vendorId,
          isActive,
        },
      });

      setManageVendorForm((current) => ({ ...current, isActive }));
      await vendorsQuery.refetch();
      toast.success(isActive ? "Vendor activated." : "Vendor suspended.");
    } catch (error) {
      console.error("Failed to update vendor state:", error);
      toast.error("Failed to update vendor status.");
    } finally {
      setIsUpdatingVendorState(false);
    }
  };

  const handleUpdateVendorDetails = async () => {
    const normalizedPhone = normalizeMoroccoPhoneInput(manageVendorForm.phoneNumber);

    if (
      !manageVendorForm.vendorId ||
      !manageVendorForm.storeName.trim() ||
      !manageVendorForm.ownerName.trim() ||
      manageVendorForm.neighborhoodIds.length === 0 ||
      !isValidMoroccoPhone(normalizedPhone)
    ) {
      toast.error("Please complete all vendor details before updating.");
      return;
    }

    setIsUpdatingVendorDetails(true);
    try {
      await saveVendorDetails({
        data: {
          vendorId: manageVendorForm.vendorId,
          storeName: manageVendorForm.storeName.trim(),
          ownerName: manageVendorForm.ownerName.trim(),
          phoneNumber: formatMoroccoPhoneForPayload(normalizedPhone),
          neighborhoodIds: manageVendorForm.neighborhoodIds,
        },
      });

      await vendorsQuery.refetch();
      toast.success("Vendor details updated successfully.");
    } catch (error) {
      console.error("Failed to update vendor details:", error);
      toast.error("Failed to update vendor details.");
    } finally {
      setIsUpdatingVendorDetails(false);
    }
  };

  const saveVendor = async () => {
    const normalizedPhone = normalizeMoroccoPhoneInput(vendorForm.phoneNumber);

    if (
      !vendorForm.storeName ||
      !vendorForm.ownerName ||
      vendorForm.neighborhoodIds.length === 0 ||
      !isValidMoroccoPhone(normalizedPhone)
    ) {
      toast.error("Please complete all vendor fields.");
      return;
    }

    try {
      await saveVendorToDatabase({
        data: {
          storeName: vendorForm.storeName.trim(),
          ownerName: vendorForm.ownerName.trim(),
          phoneNumber: formatMoroccoPhoneForPayload(normalizedPhone),
          neighborhoodIds: vendorForm.neighborhoodIds,
          isActive: vendorForm.isActive,
        },
      });

      await vendorsQuery.refetch();
      setVendorForm({
        storeName: "",
        ownerName: "",
        phoneNumber: "",
        communeId: "",
        neighborhoodIds: [],
        isActive: true,
      });
      setIsVendorPanelOpen(false);
      toast.success("Vendor saved successfully.");
    } catch (error) {
      console.error("Failed to save vendor:", error);
      toast.error("Failed to save vendor. Check console for details.");
    }
  };

  const saveCyclist = async () => {
    const normalizedPhone = normalizeMoroccoPhoneInput(cyclistForm.phoneNumber);

    if (
      !cyclistForm.fullName.trim() ||
      !cyclistForm.communeId ||
      cyclistForm.neighborhoodIds.length === 0 ||
      !isValidMoroccoPhone(normalizedPhone)
    ) {
      toast.error("Please complete all cyclist fields.");
      return;
    }

    try {
      const created = await saveCyclistToDatabase({
        data: {
          fullName: cyclistForm.fullName.trim(),
          phoneNumber: formatMoroccoPhoneForPayload(normalizedPhone),
          neighborhoodIds: cyclistForm.neighborhoodIds,
          isActive: cyclistForm.isActive,
        },
      });

      queryClient.setQueryData(["admin", "cyclists"], (current: AdminCyclistRecord[] | undefined) => [
        created,
        ...(current ?? []),
      ]);
      setCyclistForm({
        fullName: "",
        phoneNumber: "",
        communeId: "",
        neighborhoodIds: [],
        isActive: true,
      });
      setIsCyclistPanelOpen(false);
      toast.success("Cyclist saved successfully.");
    } catch (error) {
      console.error("Failed to save cyclist:", error);
      toast.error("Failed to save cyclist.");
    }
  };

  const saveCommuneHandler = async () => {
    if (!serviceZoneForm.communeName.trim()) {
      toast.error("Please enter a commune name.");
      return;
    }

    try {
      await saveCommune({ data: { name: serviceZoneForm.communeName.trim() } });
      await serviceZonesQuery.refetch();
      setServiceZoneForm((current) => ({ ...current, communeName: "" }));
      toast.success("Commune created successfully.");
    } catch (error) {
      console.error("Failed to create commune:", error);
      toast.error("Failed to create commune.");
    }
  };

  const saveNeighborhoodHandler = async () => {
    const parsedDeliveryFee = Number(serviceZoneForm.neighborhoodDeliveryFee);

    if (
      !serviceZoneForm.neighborhoodCommuneId ||
      !serviceZoneForm.neighborhoodName.trim() ||
      Number.isNaN(parsedDeliveryFee) ||
      parsedDeliveryFee < 0
    ) {
      toast.error("Please select a commune and enter a neighborhood name.");
      return;
    }

    try {
      await saveNeighborhood({
        data: {
          communeId: serviceZoneForm.neighborhoodCommuneId,
          name: serviceZoneForm.neighborhoodName.trim(),
          deliveryFee: parsedDeliveryFee,
        },
      });
      await serviceZonesQuery.refetch();
      setServiceZoneForm((current) => ({ ...current, neighborhoodName: "", neighborhoodDeliveryFee: "0" }));
      toast.success("Neighborhood created successfully.");
    } catch (error) {
      console.error("Failed to create neighborhood:", error);
      toast.error("Failed to create neighborhood.");
    }
  };

  const saveMasterProduct = async () => {
    const parsedForm = masterProductFormSchema.safeParse({
      name: productForm.name,
      nameFr: productForm.nameFr,
      nameAr: productForm.nameAr,
      categoryId: productForm.categoryId,
      measurementUnit: productForm.measurementUnit,
      popularityScore: Number(productForm.popularityScore),
    });

    if (!parsedForm.success) {
      toast.error("Please provide valid product data, including a valid category.");
      return;
    }

    const selectedCategory = activeCategories.find((category) => category.id === productForm.categoryId);
    if (!selectedCategory) {
      toast.error("Selected category is invalid.");
      return;
    }

    if (!editingProductId && !productImageFile) {
      toast.error("Please select a product image.");
      return;
    }

    try {
      setIsUploadingProduct(true);
      let imageUrl = editingProductId ? currentProductImageUrl : null;

      if (productImageFile) {
        const imageDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("Invalid image format."));
          };
          reader.onerror = () => reject(new Error("Unable to read image."));
          reader.readAsDataURL(productImageFile);
        });

        const uploaded = await uploadMasterProductImageToStorage({
          data: {
            fileName: productImageFile.name,
            contentType: productImageFile.type || "image/jpeg",
            dataUrl: imageDataUrl,
          },
        });

        imageUrl = uploaded.publicUrl;
      }

      if (editingProductId) {
        const payload = {
          id: editingProductId,
          name: productForm.name.trim(),
          nameFr: productForm.nameFr.trim(),
          nameAr: productForm.nameAr.trim(),
          categoryId: productForm.categoryId,
          measurementUnit: productForm.measurementUnit,
          popularityScore: Number(productForm.popularityScore),
          imageUrl: imageUrl ?? null,
        };
        console.log("Payload being sent:", payload);
        await updateMasterProductInDatabase({
          data: {
            ...payload,
          },
        });

        await queryClient.invalidateQueries({ queryKey: ["admin", "master-products"] });
        toast.success("Master product updated successfully.");
      } else {
        const payload = {
          name: productForm.name.trim(),
          nameFr: productForm.nameFr.trim(),
          nameAr: productForm.nameAr.trim(),
          categoryId: productForm.categoryId,
          measurementUnit: productForm.measurementUnit,
          popularityScore: Number(productForm.popularityScore),
          imageUrl: imageUrl ?? null,
        };
        console.log("Payload being sent:", payload);
        await saveMasterProductToDatabase({
          data: {
            ...payload,
          },
        });

        await queryClient.invalidateQueries({ queryKey: ["admin", "master-products"] });
        toast.success("Master product saved successfully.");
      }

      setProductForm({
        name: "",
        nameFr: "",
        nameAr: "",
        categoryId: "",
        measurementUnit: "Piece",
        popularityScore: "0",
      });
      setEditingProductId(null);
      setProductImageFile(null);
      setProductImagePreviewUrl(null);
      setCurrentProductImageUrl(null);
      setIsProductModalOpen(false);
    } catch (error) {
      console.error("Failed to save master product:", error);
      const message = error instanceof Error ? error.message : "Failed to save master product.";
      const uiMessage = message.startsWith("Storage Error:") || message.startsWith("DB Error:") ? message : `DB Error: ${message}`;
      toast.error(uiMessage);
    } finally {
      setIsUploadingProduct(false);
    }
  };

  const applyProductImageFile = (file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProductImageFile(file);
      setProductImagePreviewUrl(typeof reader.result === "string" ? reader.result : null);
    };
    reader.onerror = () => toast.error("Unable to preview selected image.");
    reader.readAsDataURL(file);
  };

  const handleProductImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    applyProductImageFile(event.target.files?.[0] ?? null);
  };

  const handleProductImageDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    applyProductImageFile(event.dataTransfer.files?.[0] ?? null);
  };

  const openCreateProductModal = () => {
    setEditingProductId(null);
    setProductForm({
      name: "",
      nameFr: "",
      nameAr: "",
      categoryId: "",
      measurementUnit: "Piece",
      popularityScore: "0",
    });
    setProductImageFile(null);
    setProductImagePreviewUrl(null);
    setCurrentProductImageUrl(null);
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (product: MasterProductEntity) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      nameFr: product.nameFr ?? product.name,
      nameAr: product.nameAr ?? product.name,
      categoryId: product.categoryId ?? "",
      measurementUnit: product.measurementUnit,
      popularityScore: String(Math.max(0, Math.trunc(product.popularityScore ?? 0))),
    });
    setProductImageFile(null);
    setCurrentProductImageUrl(product.imageUrl ?? null);
    setProductImagePreviewUrl(product.imageUrl ?? fallbackProductImage);
    setIsProductModalOpen(true);
  };

  const archiveProduct = async (product: MasterProductEntity) => {
    setPendingArchiveProduct(product);
  };

  const confirmArchiveProduct = async () => {
    if (!pendingArchiveProduct) return;
    try {
      await archiveMasterProductInDatabase({ data: { id: pendingArchiveProduct.id } });
      queryClient.setQueryData(["admin", "master-products"], (current: any[] | undefined) =>
        (current ?? []).filter((row) => row.id !== pendingArchiveProduct.id),
      );
      toast.success("Product archived.");
      setPendingArchiveProduct(null);
    } catch (error) {
      console.error("Failed to archive master product:", error);
      toast.error("Failed to archive product.");
    }
  };

  const applyCategoryImageFile = (file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCategoryImageFile(file);
      setCategoryImagePreviewUrl(typeof reader.result === "string" ? reader.result : null);
    };
    reader.onerror = () => toast.error("Unable to preview selected image.");
    reader.readAsDataURL(file);
  };

  const handleCategoryImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    applyCategoryImageFile(event.target.files?.[0] ?? null);
  };

  const resetCategoryForm = () => {
    setCategoryForm({
      id: "",
      nameEn: "",
      nameFr: "",
      nameAr: "",
      imageUrl: "",
      iconName: "Carrot",
      accentColor: "#f3f4f6",
      sortOrder: "0",
      isActive: true,
    });
    setCategoryImageFile(null);
    setCategoryImagePreviewUrl(null);
  };

  const editCategory = (category: CategoryAdminRow) => {
    const resolvedIconName = CATEGORY_ICON_OPTIONS.includes((category.icon_name ?? "") as CategoryIconName)
      ? (category.icon_name as CategoryIconName)
      : "Carrot";

    setCategoryForm({
      id: category.id,
      nameEn: category.name_en,
      nameFr: category.name_fr,
      nameAr: category.name_ar,
      imageUrl: category.image_url ?? "",
      iconName: resolvedIconName,
      accentColor: category.accent_color ?? "#f3f4f6",
      sortOrder: String(category.sort_order),
      isActive: category.is_active,
    });
    setCategoryImageFile(null);
    setCategoryImagePreviewUrl(category.image_url ?? null);
  };

  const saveCategory = async () => {
    if (!categoryForm.nameEn.trim() || !categoryForm.nameFr.trim() || !categoryForm.nameAr.trim()) {
      toast.error("Please enter category names in EN, FR, and AR.");
      return;
    }

    setIsSavingCategory(true);
    try {
      let finalImageUrl = categoryForm.imageUrl.trim() || null;

      if (categoryImageFile) {
        const extension = categoryImageFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const sanitizedBaseName = categoryImageFile.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[^a-zA-Z0-9-_]/g, "-")
          .slice(0, 60);
        const fileName = `${crypto.randomUUID()}-${sanitizedBaseName || "category"}.${extension}`;
        const filePath = `categories/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("products")
          .upload(filePath, categoryImageFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError || !uploadData?.path) {
          throw new Error(uploadError?.message || "Category image upload failed.");
        }

        const { data: publicUrlData } = supabase.storage.from("products").getPublicUrl(uploadData.path);
        finalImageUrl = publicUrlData.publicUrl;
      }

      const payload = {
        nameEn: categoryForm.nameEn.trim(),
        nameFr: categoryForm.nameFr.trim(),
        nameAr: categoryForm.nameAr.trim(),
        imageUrl: finalImageUrl,
        iconName: categoryForm.iconName,
        accentColor: categoryForm.accentColor.trim() || "#f3f4f6",
        sortOrder: Number.parseInt(categoryForm.sortOrder || "0", 10) || 0,
        isActive: categoryForm.isActive,
      };

      if (categoryForm.id) {
        const updated = await updateCategoryInDatabase({
          data: {
            id: categoryForm.id,
            ...payload,
          },
        });

        queryClient.setQueryData(["admin", "categories"], (current: CategoryAdminRow[] | undefined) =>
          (current ?? []).map((row) => (row.id === updated.id ? updated : row)),
        );
        toast.success("Category updated.");
      } else {
        const created = await createCategoryInDatabase({ data: payload });

        queryClient.setQueryData(["admin", "categories"], (current: CategoryAdminRow[] | undefined) =>
          [...(current ?? []), created].sort((a, b) => a.sort_order - b.sort_order),
        );
        toast.success("Category created.");
      }

      resetCategoryForm();
    } catch (error) {
      console.error("Failed to save category:", error);
      toast.error("Failed to save category.");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const resetAdForm = () => {
    setAdForm({ id: "", imageUrl: "", linkUrl: "", sortOrder: "0", isActive: true });
    setAdImageFile(null);
    setAdImagePreviewUrl(null);
  };

  const resetAnnouncementForm = () => {
    setAnnouncementForm({
      id: "",
      content: "",
      contentFr: "",
      contentAr: "",
      isActive: true,
      bgColor: "#deff9a",
      textColor: "#000000",
    });
  };

  const saveAd = async () => {
    if (!adForm.imageUrl.trim() && !adImageFile) {
      toast.error("Please provide an ad image URL or upload an image.");
      return;
    }

    const parsedSortOrder = Number(adForm.sortOrder);
    if (!Number.isFinite(parsedSortOrder) || parsedSortOrder < 0) {
      toast.error("Sort order must be zero or greater.");
      return;
    }

    setIsSavingAd(true);
    try {
      let adImageUrl = adForm.imageUrl.trim();

      if (adImageFile) {
        const extension = adImageFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const sanitizedBaseName = adImageFile.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[^a-zA-Z0-9-_]/g, "-")
          .slice(0, 60);
        const fileName = `${crypto.randomUUID()}-${sanitizedBaseName || "ad"}.${extension}`;
        const filePath = `site-ads/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("products")
          .upload(filePath, adImageFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError || !uploadData?.path) {
          throw new Error(uploadError?.message || "Ad image upload failed.");
        }

        const { data: publicUrlData } = supabase.storage.from("products").getPublicUrl(uploadData.path);
        adImageUrl = publicUrlData.publicUrl;
      }

      if (adForm.id) {
        await updateSiteAdInDatabase({
          data: {
            id: adForm.id,
            imageUrl: adImageUrl,
            linkUrl: adForm.linkUrl.trim() || null,
            sortOrder: Math.floor(parsedSortOrder),
            isActive: adForm.isActive,
          },
        });
        toast.success("Ad updated.");
      } else {
        await createSiteAdInDatabase({
          data: {
            imageUrl: adImageUrl,
            linkUrl: adForm.linkUrl.trim() || null,
            sortOrder: Math.floor(parsedSortOrder),
            isActive: adForm.isActive,
          },
        });
        toast.success("Ad created.");
      }

      await siteAdsQuery.refetch();
      resetAdForm();
    } catch (error) {
      console.error("Failed to save ad:", error);
      toast.error("Failed to save ad.");
    } finally {
      setIsSavingAd(false);
    }
  };

  const saveAnnouncement = async () => {
    if (!announcementForm.content.trim() || !announcementForm.contentFr.trim() || !announcementForm.contentAr.trim()) {
      toast.error("Please enter ticker messages in EN, FR, and AR.");
      return;
    }

    setIsSavingAnnouncement(true);
    try {
      if (announcementForm.id) {
        await updateAnnouncementInDatabase({
          data: {
            id: announcementForm.id,
            content: announcementForm.content.trim(),
            contentFr: announcementForm.contentFr.trim(),
            contentAr: announcementForm.contentAr.trim(),
            isActive: announcementForm.isActive,
            bgColor: announcementForm.bgColor.trim() || "#deff9a",
            textColor: announcementForm.textColor.trim() || "#000000",
          },
        });
        toast.success("Announcement updated.");
      } else {
        await createAnnouncementInDatabase({
          data: {
            content: announcementForm.content.trim(),
            contentFr: announcementForm.contentFr.trim(),
            contentAr: announcementForm.contentAr.trim(),
            isActive: announcementForm.isActive,
            bgColor: announcementForm.bgColor.trim() || "#deff9a",
            textColor: announcementForm.textColor.trim() || "#000000",
          },
        });
        toast.success("Announcement created.");
      }

      await announcementsQuery.refetch();
      resetAnnouncementForm();
    } catch (error) {
      console.error("Failed to save announcement:", error);
      toast.error("Failed to save announcement.");
    } finally {
      setIsSavingAnnouncement(false);
    }
  };

  const editAd = (ad: {
    id: string;
    image_url: string;
    link_url: string | null;
    sort_order: number;
    is_active: boolean;
  }) => {
    setAdForm({
      id: ad.id,
      imageUrl: ad.image_url,
      linkUrl: ad.link_url ?? "",
      sortOrder: String(ad.sort_order ?? 0),
      isActive: ad.is_active,
    });
    setAdImageFile(null);
    setAdImagePreviewUrl(ad.image_url);
  };

  const applyAdImageFile = (file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAdImageFile(file);
      setAdImagePreviewUrl(typeof reader.result === "string" ? reader.result : null);
    };
    reader.onerror = () => toast.error("Unable to preview selected ad image.");
    reader.readAsDataURL(file);
  };

  const handleAdImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    applyAdImageFile(event.target.files?.[0] ?? null);
  };

  const removeAd = async (id: string) => {
    try {
      await deleteSiteAdInDatabase({ data: { id } });
      await siteAdsQuery.refetch();
      if (adForm.id === id) {
        resetAdForm();
      }
      toast.success("Ad removed.");
    } catch (error) {
      console.error("Failed to remove ad:", error);
      toast.error("Failed to remove ad.");
    }
  };

  const editAnnouncement = (announcement: {
    id: string;
    content: string;
    content_fr: string | null;
    content_ar: string | null;
    is_active: boolean;
    bg_color: string;
    text_color: string;
  }) => {
    setAnnouncementForm({
      id: announcement.id,
      content: announcement.content,
      contentFr: announcement.content_fr ?? announcement.content,
      contentAr: announcement.content_ar ?? announcement.content,
      isActive: announcement.is_active,
      bgColor: announcement.bg_color,
      textColor: announcement.text_color,
    });
  };

  const removeAnnouncement = async (id: string) => {
    try {
      await deleteAnnouncementInDatabase({ data: { id } });
      await announcementsQuery.refetch();
      if (announcementForm.id === id) {
        resetAnnouncementForm();
      }
      toast.success("Announcement removed.");
    } catch (error) {
      console.error("Failed to remove announcement:", error);
      toast.error("Failed to remove announcement.");
    }
  };

  const saveReceiptSettings = async () => {
    if (
      !receiptForm.id ||
      !receiptForm.storeName.trim() ||
      !receiptForm.address.trim() ||
      !receiptForm.phone.trim() ||
      !receiptForm.footerMessage.trim()
    ) {
      toast.error("Please complete all required receipt settings.");
      return;
    }

    try {
      setIsSavingReceiptSettings(true);
      await saveAdminInvoiceSettings({
        data: {
          id: receiptForm.id,
          storeName: receiptForm.storeName.trim(),
          address: receiptForm.address.trim(),
          phone: receiptForm.phone.trim(),
          taxId: receiptForm.taxId.trim() || null,
          footerMessage: receiptForm.footerMessage.trim(),
        },
      });

      await adminInvoiceSettingsQuery.refetch();
      toast.success("Configuration saved successfully");
    } catch (error) {
      console.error("Failed to save receipt settings:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save receipt settings.");
    } finally {
      setIsSavingReceiptSettings(false);
    }
  };

  const saveGlobalSettings = async () => {
    if (!settingsForm.id) {
      toast.error("Global settings are still loading.");
      return;
    }

    const globalDeliveryFee = Number(settingsForm.deliveryFeeMad);
    const minimumOrderAmount = Number(settingsForm.minimumOrderMad);
    const freeDeliveryThreshold = Number(settingsForm.freeDeliveryThresholdMad);

    if (
      Number.isNaN(globalDeliveryFee) ||
      Number.isNaN(minimumOrderAmount) ||
      Number.isNaN(freeDeliveryThreshold) ||
      globalDeliveryFee < 0 ||
      minimumOrderAmount < 0 ||
      freeDeliveryThreshold < 0
    ) {
      toast.error("Please enter valid non-negative values for global settings.");
      return;
    }

    try {
      setIsSavingGlobalSettings(true);
      await saveGlobalSettingsToDatabase({
        data: {
          id: settingsForm.id,
          globalDeliveryFee,
          minimumOrderAmount,
          freeDeliveryThreshold,
          marketplaceActive: settingsForm.marketplaceActive,
        },
      });

      await globalSettingsQuery.refetch();
      toast.success("Configuration saved successfully");
    } catch (error) {
      console.error("Failed to save global settings:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save global settings.");
    } finally {
      setIsSavingGlobalSettings(false);
    }
  };

  const renameCommune = async (communeId: string, currentName: string) => {
    const nextName = window.prompt("Edit commune name", currentName)?.trim();
    if (!nextName || nextName === currentName) {
      return;
    }

    try {
      setIsRenamingCommuneId(communeId);
      const updated = await editCommune({ data: { id: communeId, name: nextName } });
      queryClient.setQueryData(["admin", "service-zones"], (current: ServiceZoneTree | undefined) =>
        (current ?? []).map((zone) => (zone.id === communeId ? { ...zone, name: updated.name } : zone)),
      );
      toast.success("Commune updated.");
    } catch (error) {
      console.error("Failed to update commune:", error);
      toast.error("Failed to update commune.");
    } finally {
      setIsRenamingCommuneId(null);
    }
  };

  const renameNeighborhood = async (neighborhoodId: string, currentName: string, currentDeliveryFee: number) => {
    const nextName = window.prompt("Edit neighborhood name", currentName)?.trim();
    if (!nextName || nextName === currentName) {
      return;
    }

    const nextDeliveryFeeRaw = window.prompt("Edit delivery fee (MAD)", String(currentDeliveryFee))?.trim();
    if (!nextDeliveryFeeRaw) {
      return;
    }

    const nextDeliveryFee = Number(nextDeliveryFeeRaw);
    if (Number.isNaN(nextDeliveryFee) || nextDeliveryFee < 0) {
      toast.error("Delivery fee must be a valid positive number.");
      return;
    }

    try {
      setIsRenamingNeighborhoodId(neighborhoodId);
      const updated = await editNeighborhood({ data: { id: neighborhoodId, name: nextName, deliveryFee: nextDeliveryFee } });
      queryClient.setQueryData(["admin", "service-zones"], (current: ServiceZoneTree | undefined) =>
        (current ?? []).map((zone) =>
          zone.id === updated.communeId
            ? {
                ...zone,
                neighborhoods: zone.neighborhoods.map((n) =>
                  n.id === neighborhoodId
                    ? { ...n, name: updated.name, deliveryFee: Number(updated.deliveryFee ?? 0) }
                    : n,
                ),
              }
            : zone,
        ),
      );
      toast.success("Neighborhood updated.");
    } catch (error) {
      console.error("Failed to update neighborhood:", error);
      toast.error("Failed to update neighborhood.");
    } finally {
      setIsRenamingNeighborhoodId(null);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/20">
        <AdminSidebar activeTab={tab} />
        <SidebarInset className="bg-transparent">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
            <SidebarTrigger className="h-9 w-9 rounded-md border border-border" />
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground">Super-Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">Marketplace operations and control center</p>
            </div>
          </header>

          <main className="space-y-5 p-4 md:p-6">
            {!dbHealthQuery.isLoading && !dbHealthQuery.data?.healthy ? (
              <section className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive shadow-sm">
                <div className="flex items-start gap-3">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold">Database health check failed</p>
                    <p>
                      {dbHealthQuery.data?.error
                        ? dbHealthQuery.data.error
                        : "Required tables are missing. Please run backend migrations before using admin data."}
                    </p>
                    {dbHealthQuery.data?.missingTables?.length ? (
                      <p>Missing tables: {dbHealthQuery.data.missingTables.join(", ")}</p>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}
            <div key={tab} className="animate-in fade-in duration-200">
              {tab === "overview" ? (
                <OverviewSection
                  analytics={overviewAnalyticsQuery.data}
                  isLoading={dbHealthQuery.isLoading || overviewAnalyticsQuery.isLoading}
                  error={overviewAnalyticsQuery.error}
                />
              ) : null}
              {tab === "vendors" ? (
                <VendorsSection
                  vendors={vendors}
                  isLoading={dbHealthQuery.isLoading || vendorsQuery.isLoading}
                  onAddVendor={() => setIsVendorPanelOpen(true)}
                  onManageVendor={openManageVendorPanel}
                />
              ) : null}
              {tab === "cyclists" ? (
                <CyclistsSection
                  cyclists={cyclists}
                  isLoading={dbHealthQuery.isLoading || cyclistsQuery.isLoading}
                  onAddCyclist={() => setIsCyclistPanelOpen(true)}
                />
              ) : null}
              {tab === "service-zones" ? (
                <ServiceZonesSection
                  zones={serviceZones}
                  isLoading={dbHealthQuery.isLoading || serviceZonesQuery.isLoading}
                  isRenamingCommuneId={isRenamingCommuneId}
                  isRenamingNeighborhoodId={isRenamingNeighborhoodId}
                  form={serviceZoneForm}
                  onFormChange={setServiceZoneForm}
                  onSaveCommune={saveCommuneHandler}
                  onSaveNeighborhood={saveNeighborhoodHandler}
                  onEditCommune={renameCommune}
                  onEditNeighborhood={renameNeighborhood}
                />
              ) : null}
              {tab === "catalog" ? (
                <CatalogSection
                  products={masterProducts}
                  categories={categories}
                  isLoading={dbHealthQuery.isLoading || masterProductsQuery.isLoading}
                  onAddProduct={openCreateProductModal}
                  onEditProduct={openEditProductModal}
                  onArchiveProduct={archiveProduct}
                />
              ) : null}
              {tab === "categories" ? (
                <CategoriesSection
                  categories={categories}
                  isLoading={dbHealthQuery.isLoading || categoriesQuery.isLoading}
                  form={categoryForm}
                  onFormChange={setCategoryForm}
                  onSave={saveCategory}
                  onEdit={editCategory}
                  onReset={resetCategoryForm}
                  isSaving={isSavingCategory}
                  imageInputRef={categoryImageInputRef}
                  imagePreviewUrl={categoryImagePreviewUrl}
                  onImageChange={handleCategoryImageChange}
                />
              ) : null}
              {tab === "ads-content" ? (
                <AdsContentSection
                  ads={(siteAdsQuery.data ?? []) as Array<{
                    id: string;
                    image_url: string;
                    link_url: string | null;
                    sort_order: number;
                    is_active: boolean;
                    created_at: string;
                  }>}
                  announcements={(announcementsQuery.data ?? []) as Array<{
                    id: string;
                    content: string;
                    content_fr: string | null;
                    content_ar: string | null;
                    is_active: boolean;
                    bg_color: string;
                    text_color: string;
                    created_at: string;
                  }>}
                  isLoading={
                    dbHealthQuery.isLoading || siteAdsQuery.isLoading || announcementsQuery.isLoading
                  }
                  adForm={adForm}
                  onAdFormChange={setAdForm}
                  onSaveAd={saveAd}
                  onEditAd={editAd}
                  onDeleteAd={removeAd}
                  onResetAdForm={resetAdForm}
                  isSavingAd={isSavingAd}
                  adImageInputRef={adImageInputRef}
                  adImagePreviewUrl={adImagePreviewUrl}
                  onAdImageChange={handleAdImageChange}
                  announcementForm={announcementForm}
                  onAnnouncementFormChange={setAnnouncementForm}
                  onSaveAnnouncement={saveAnnouncement}
                  onEditAnnouncement={editAnnouncement}
                  onDeleteAnnouncement={removeAnnouncement}
                  onResetAnnouncementForm={resetAnnouncementForm}
                  isSavingAnnouncement={isSavingAnnouncement}
                />
              ) : null}
              {tab === "orders" ? (
                <OrdersSection
                  orders={filteredOrders}
                  isLoading={dbHealthQuery.isLoading || adminOrdersQuery.isLoading}
                  error={adminOrdersQuery.error}
                  statusFilter={ordersStatusFilter}
                  onStatusFilterChange={setOrdersStatusFilter}
                />
              ) : null}
              {tab === "customers" ? (
                <CustomersSection
                  customers={adminCustomers}
                  isLoading={dbHealthQuery.isLoading || adminCustomersQuery.isLoading}
                  error={adminCustomersQuery.error}
                />
              ) : null}
              {tab === "settings" ? (
                <SettingsSection
                  form={settingsForm}
                  onFormChange={setSettingsForm}
                  onSaveGlobalSettings={saveGlobalSettings}
                  isGlobalSettingsLoading={isSavingGlobalSettings || dbHealthQuery.isLoading || globalSettingsQuery.isLoading}
                  receiptForm={receiptForm}
                  onReceiptFormChange={setReceiptForm}
                  onSaveReceiptSettings={saveReceiptSettings}
                  isReceiptSettingsLoading={
                    isSavingReceiptSettings || dbHealthQuery.isLoading || adminInvoiceSettingsQuery.isLoading
                  }
                />
              ) : null}
            </div>
          </main>
        </SidebarInset>
      </div>

      <Sheet open={isVendorPanelOpen} onOpenChange={setIsVendorPanelOpen}>
        <SheetContent side="right" className="w-full max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add New Vendor</SheetTitle>
            <SheetDescription>Register a vendor for your marketplace network.</SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <label htmlFor="store-name" className="text-sm font-medium text-foreground">
                Store Name
              </label>
              <input
                id="store-name"
                value={vendorForm.storeName}
                onChange={(event) => setVendorForm((current) => ({ ...current, storeName: event.target.value }))}
                placeholder="e.g. Casa Fresh Market"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="owner-name" className="text-sm font-medium text-foreground">
                Owner Name
              </label>
              <input
                id="owner-name"
                value={vendorForm.ownerName}
                onChange={(event) => setVendorForm((current) => ({ ...current, ownerName: event.target.value }))}
                placeholder="e.g. Amal Benkirane"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="phone-number" className="text-sm font-medium text-foreground">
                Phone Number
              </label>
              <div className="flex h-10 items-center overflow-hidden rounded-md border border-input bg-background focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/30">
                <span className="px-3 text-sm font-medium text-muted-foreground">+212</span>
                <input
                  id="phone-number"
                  value={vendorForm.phoneNumber}
                  onChange={(event) =>
                    setVendorForm((current) => ({
                      ...current,
                      phoneNumber: normalizeMoroccoPhoneInput(event.target.value),
                    }))
                  }
                  placeholder="6XXXXXXXX"
                  inputMode="numeric"
                  autoComplete="tel"
                  className="h-full w-full border-0 bg-transparent px-1.5 pr-3 text-sm outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="vendor-commune" className="text-sm font-medium text-foreground">
                Jamaa Tourabiya
              </label>
              <select
                id="vendor-commune"
                value={vendorForm.communeId}
                onChange={(event) =>
                  setVendorForm((current) => ({
                    ...current,
                    communeId: event.target.value,
                    neighborhoodIds: [],
                  }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              >
                <option value="">Select commune</option>
                {communeOptions.map((commune) => (
                  <option key={commune.id} value={commune.id}>
                    {commune.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Hay / Douar (Multi-select)</label>
              <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border border-input bg-background p-3">
                {!vendorForm.communeId ? (
                  <p className="text-sm text-muted-foreground">Select a commune first.</p>
                ) : addVendorNeighborhoodOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">All neighborhoods in this commune are already claimed.</p>
                ) : (
                  addVendorNeighborhoodOptions.map((neighborhood) => {
                    const isChecked = vendorForm.neighborhoodIds.includes(neighborhood.id);
                    return (
                      <label key={neighborhood.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(event) => toggleVendorNeighborhood(neighborhood.id, event.target.checked)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span className="text-foreground">{neighborhood.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
              {vendorForm.neighborhoodIds.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {addVendorNeighborhoodOptions
                    .filter((n) => vendorForm.neighborhoodIds.includes(n.id))
                    .map((neighborhood) => (
                      <button
                        key={neighborhood.id}
                        type="button"
                        onClick={() => toggleVendorNeighborhood(neighborhood.id, false)}
                        className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground"
                      >
                        {neighborhood.name} ×
                      </button>
                    ))}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Active Status</p>
                <p className="text-xs text-muted-foreground">Enable if this vendor can receive orders now.</p>
              </div>
              <Switch
                checked={vendorForm.isActive}
                onCheckedChange={(checked) => setVendorForm((current) => ({ ...current, isActive: checked }))}
              />
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button variant="hero" className="w-full rounded-md" onClick={saveVendor}>
              Save Vendor
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={isCyclistPanelOpen} onOpenChange={setIsCyclistPanelOpen}>
        <SheetContent side="right" className="w-full max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add New Cyclist</SheetTitle>
            <SheetDescription>Register a cyclist and assign one or more service neighborhoods.</SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <label htmlFor="cyclist-full-name" className="text-sm font-medium text-foreground">
                Full Name
              </label>
              <input
                id="cyclist-full-name"
                value={cyclistForm.fullName}
                onChange={(event) => setCyclistForm((current) => ({ ...current, fullName: event.target.value }))}
                placeholder="e.g. Yassine El Idrissi"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="cyclist-phone-number" className="text-sm font-medium text-foreground">
                Phone Number
              </label>
              <div className="flex h-10 items-center overflow-hidden rounded-md border border-input bg-background focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/30">
                <span className="px-3 text-sm font-medium text-muted-foreground">+212</span>
                <input
                  id="cyclist-phone-number"
                  value={cyclistForm.phoneNumber}
                  onChange={(event) =>
                    setCyclistForm((current) => ({
                      ...current,
                      phoneNumber: normalizeMoroccoPhoneInput(event.target.value),
                    }))
                  }
                  placeholder="6XXXXXXXX"
                  inputMode="numeric"
                  autoComplete="tel"
                  className="h-full w-full border-0 bg-transparent px-1.5 pr-3 text-sm outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="cyclist-commune" className="text-sm font-medium text-foreground">
                Jamaa Tourabiya
              </label>
              <select
                id="cyclist-commune"
                value={cyclistForm.communeId}
                onChange={(event) =>
                  setCyclistForm((current) => ({
                    ...current,
                    communeId: event.target.value,
                    neighborhoodIds: [],
                  }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              >
                <option value="">Select commune</option>
                {communeOptions.map((commune) => (
                  <option key={commune.id} value={commune.id}>
                    {commune.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Hays / Douars (Multi-select)
              </label>
              <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border border-input bg-background p-3">
                {!cyclistForm.communeId ? (
                  <p className="text-sm text-muted-foreground">Select a commune first.</p>
                ) : cyclistNeighborhoodOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No neighborhoods available in this commune.</p>
                ) : (
                  cyclistNeighborhoodOptions.map((neighborhood) => {
                    const isChecked = cyclistForm.neighborhoodIds.includes(neighborhood.id);

                    return (
                      <label
                        key={neighborhood.id}
                        className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(event) => toggleCyclistNeighborhood(neighborhood.id, event.target.checked)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span className="text-foreground">{neighborhood.name}</span>
                      </label>
                    );
                  })
                )}
              </div>

              {cyclistForm.neighborhoodIds.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Selected: {cyclistForm.neighborhoodIds.length} neighborhood
                  {cyclistForm.neighborhoodIds.length === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Active Status</p>
                <p className="text-xs text-muted-foreground">Enable if this cyclist can accept deliveries.</p>
              </div>
              <Switch
                checked={cyclistForm.isActive}
                onCheckedChange={(checked) => setCyclistForm((current) => ({ ...current, isActive: checked }))}
              />
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button variant="hero" className="w-full rounded-md" onClick={saveCyclist}>
              Save Cyclist
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={isManageVendorPanelOpen}
        onOpenChange={(open) => {
          setIsManageVendorPanelOpen(open);
          if (!open) {
            setSelectedVendor(null);
          }
        }}
      >
        <SheetContent side="right" className="w-full max-w-2xl overflow-y-auto p-0">
          <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-6 py-5 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vendor Profile & Management</p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">
                  {manageVendorForm.storeName || selectedVendor?.storeName || "Vendor"}
                </h3>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {manageVendorForm.isActive ? "Active" : "Suspended"}
                </span>
                <Switch
                  checked={manageVendorForm.isActive}
                  disabled={isUpdatingVendorState || !manageVendorForm.vendorId}
                  onCheckedChange={handleVendorActiveStateToggle}
                />
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            <Tabs defaultValue="edit-details" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 rounded-xl">
                <TabsTrigger value="edit-details">Edit Details</TabsTrigger>
                <TabsTrigger value="sales-analytics">Sales Analytics</TabsTrigger>
              </TabsList>

              <TabsContent value="edit-details" className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="manage-store-name" className="text-sm font-medium text-foreground">Store Name</label>
                  <input
                    id="manage-store-name"
                    value={manageVendorForm.storeName}
                    onChange={(event) =>
                      setManageVendorForm((current) => ({
                        ...current,
                        storeName: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="manage-owner-name" className="text-sm font-medium text-foreground">Owner Name</label>
                  <input
                    id="manage-owner-name"
                    value={manageVendorForm.ownerName}
                    onChange={(event) =>
                      setManageVendorForm((current) => ({
                        ...current,
                        ownerName: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="manage-phone-number" className="text-sm font-medium text-foreground">Phone Number</label>
                  <div className="flex h-10 items-center overflow-hidden rounded-md border border-input bg-background focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/30">
                    <span className="px-3 text-sm font-medium text-muted-foreground">+212</span>
                    <input
                      id="manage-phone-number"
                      value={manageVendorForm.phoneNumber}
                      onChange={(event) =>
                        setManageVendorForm((current) => ({
                          ...current,
                          phoneNumber: normalizeMoroccoPhoneInput(event.target.value),
                        }))
                      }
                      placeholder="6XXXXXXXX"
                      inputMode="numeric"
                      autoComplete="tel"
                      className="h-full w-full border-0 bg-transparent px-1.5 pr-3 text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="manage-vendor-commune" className="text-sm font-medium text-foreground">Jamaa Tourabiya</label>
                    <select
                      id="manage-vendor-commune"
                      value={manageVendorForm.communeId}
                      onChange={(event) =>
                        setManageVendorForm((current) => ({
                          ...current,
                          communeId: event.target.value,
                          neighborhoodIds: [],
                        }))
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                    >
                      <option value="">Select commune</option>
                      {communeOptions.map((commune) => (
                        <option key={commune.id} value={commune.id}>
                          {commune.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Hay / Douar (Multi-select)</label>
                    <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border border-input bg-background p-3">
                      {!manageVendorForm.communeId ? (
                        <p className="text-sm text-muted-foreground">Select a commune first.</p>
                      ) : manageNeighborhoodOptions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No available neighborhoods in this commune.</p>
                      ) : (
                        manageNeighborhoodOptions.map((neighborhood) => {
                          const isChecked = manageVendorForm.neighborhoodIds.includes(neighborhood.id);
                          return (
                            <label key={neighborhood.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2 text-sm">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(event) => toggleManageVendorNeighborhood(neighborhood.id, event.target.checked)}
                                className="h-4 w-4 accent-primary"
                              />
                              <span className="text-foreground">{neighborhood.name}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                    {manageVendorForm.neighborhoodIds.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {manageNeighborhoodOptions
                          .filter((n) => manageVendorForm.neighborhoodIds.includes(n.id))
                          .map((neighborhood) => (
                            <button
                              key={neighborhood.id}
                              type="button"
                              onClick={() => toggleManageVendorNeighborhood(neighborhood.id, false)}
                              className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground"
                            >
                              {neighborhood.name} ×
                            </button>
                          ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <Button
                  variant="hero"
                  className="w-full rounded-lg"
                  disabled={isUpdatingVendorDetails}
                  onClick={handleUpdateVendorDetails}
                >
                  {isUpdatingVendorDetails ? "Updating..." : "Update Vendor Details"}
                </Button>
              </TabsContent>

              <TabsContent value="sales-analytics" className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <article className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md">
                    <p className="text-xs text-muted-foreground">Today's Revenue (MAD)</p>
                    <p className="mt-2 text-xl font-semibold text-foreground">
                      {Math.round((analyticsQuery.data ?? emptyVendorAnalytics).todaysRevenueMad)}
                    </p>
                  </article>
                  <article className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md">
                    <p className="text-xs text-muted-foreground">Total All-Time Sales (MAD)</p>
                    <p className="mt-2 text-xl font-semibold text-foreground">
                      {Math.round((analyticsQuery.data ?? emptyVendorAnalytics).totalAllTimeSalesMad)}
                    </p>
                  </article>
                  <article className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md">
                    <p className="text-xs text-muted-foreground">Total Completed Orders</p>
                    <p className="mt-2 text-xl font-semibold text-foreground">
                      {(analyticsQuery.data ?? emptyVendorAnalytics).totalCompletedOrders}
                    </p>
                  </article>
                </div>

                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Order ID</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Total</th>
                        <th className="px-3 py-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsQuery.isLoading ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">
                            Loading analytics...
                          </td>
                        </tr>
                      ) : (analyticsQuery.data ?? emptyVendorAnalytics).lastFiveOrders.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">
                            No recent orders for this vendor.
                          </td>
                        </tr>
                      ) : (
                        (analyticsQuery.data ?? emptyVendorAnalytics).lastFiveOrders.map((order) => (
                          <tr key={order.id} className="border-t border-border bg-card">
                            <td className="px-3 py-2 font-medium text-foreground">#{order.id.slice(0, 8)}</td>
                            <td className="px-3 py-2 text-muted-foreground">{order.status}</td>
                            <td className="px-3 py-2 text-muted-foreground">{Math.round(order.totalMad)} MAD</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={isProductModalOpen}
        onOpenChange={(open) => {
          setIsProductModalOpen(open);
          if (!open) {
            setEditingProductId(null);
            setProductImageFile(null);
            setProductImagePreviewUrl(null);
            setCurrentProductImageUrl(null);
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProductId ? "Edit Master Product" : "Add Master Product"}</DialogTitle>
            <DialogDescription>
              {editingProductId
                ? "Update the shared product reference across all vendors."
                : "Set the shared product reference for all vendors."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <button
              type="button"
              onClick={() => productImageInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleProductImageDrop}
              className="w-full rounded-md border border-dashed border-border bg-muted/40 p-4 text-center transition hover:border-primary/60"
            >
              <input
                ref={productImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProductImageChange}
              />
              {productImagePreviewUrl ? (
                <img
                  src={productImagePreviewUrl}
                  alt="Selected product preview"
                  className="mx-auto aspect-square w-full max-w-[240px] rounded-md bg-muted/40 object-contain object-center p-2"
                />
              ) : (
                <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ImagePlus className="size-5" />
                </span>
              )}
              <p className="mt-2 text-sm font-medium text-foreground">
                {productImagePreviewUrl ? "Image selected" : "Upload product image"}
              </p>
              <p className="text-xs text-muted-foreground">Click or drag and drop an image file</p>
            </button>

            <div className="space-y-2">
              <label htmlFor="product-name-en" className="text-sm font-medium text-foreground">
                {t("admin.productNameEn")}
              </label>
              <input
                id="product-name-en"
                value={productForm.name}
                onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Olive Oil 1L"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="product-name-fr" className="text-sm font-medium text-foreground">
                {t("admin.productNameFr")}
              </label>
              <input
                id="product-name-fr"
                value={productForm.nameFr}
                onChange={(event) => setProductForm((current) => ({ ...current, nameFr: event.target.value }))}
                placeholder="e.g. Huile d'olive 1L"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="product-name-ar" className="text-sm font-medium text-foreground">
                {t("admin.productNameAr")}
              </label>
              <input
                id="product-name-ar"
                value={productForm.nameAr}
                onChange={(event) => setProductForm((current) => ({ ...current, nameAr: event.target.value }))}
                placeholder="مثال: زيت الزيتون 1 لتر"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="category" className="text-sm font-medium text-foreground">
                Category
              </label>
              <select
                id="category"
                value={productForm.categoryId}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    categoryId: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              >
                <option value="">Select category</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name_en}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="measurement-unit" className="text-sm font-medium text-foreground">
                Measurement Unit
              </label>
              <select
                id="measurement-unit"
                value={productForm.measurementUnit}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    measurementUnit: event.target.value as MeasurementUnit,
                  }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              >
                {measurementUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="popularity-score" className="text-sm font-medium text-foreground">
                Popularity Score
              </label>
              <input
                id="popularity-score"
                type="number"
                min={0}
                step={1}
                value={productForm.popularityScore}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    popularityScore: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="hero"
              className="w-full rounded-md"
              onClick={saveMasterProduct}
              disabled={isUploadingProduct}
            >
              {isUploadingProduct ? "Uploading..." : editingProductId ? "Update Product" : "Save Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingArchiveProduct)} onOpenChange={(open) => (!open ? setPendingArchiveProduct(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive product?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingArchiveProduct
                ? `Are you sure you want to archive ${pendingArchiveProduct.name}?`
                : "Are you sure you want to archive this product?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchiveProduct}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}

function AdminSidebar({ activeTab }: { activeTab: AdminTab }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-border/60">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{collapsed ? "" : "Control Center"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.tab}>
                  <SidebarMenuButton asChild isActive={activeTab === item.tab} tooltip={item.label}>
                    <Link
                      to="/admin"
                      search={{ tab: item.tab }}
                      className="flex items-center gap-2 rounded-md hover:bg-sidebar-accent/70"
                    >
                      <item.icon className="size-4" />
                      {!collapsed ? <span>{item.label}</span> : null}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function OverviewSection({
  analytics,
  isLoading,
  error,
}: {
  analytics:
    | {
        totalOrdersToday: number;
        activeVendors: number;
        totalRevenueMad: number;
        weeklyTrends: Array<{ day: string; label: string; orders: number }>;
      }
    | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  if (error) {
    return (
      <section className="rounded-lg border border-destructive/40 bg-destructive/10 p-5 text-destructive shadow-sm">
        Failed to load overview analytics.
      </section>
    );
  }

  const metrics = [
    { label: "Total Orders Today", value: String(analytics?.totalOrdersToday ?? 0), icon: PackageCheck },
    { label: "Active Vendors", value: String(analytics?.activeVendors ?? 0), icon: Store },
    {
      label: "Total Revenue",
      value: `${Math.round(analytics?.totalRevenueMad ?? 0)} MAD`,
      icon: CircleDollarSign,
    },
  ];

  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <metric.icon className="size-4" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-foreground">
              {isLoading ? <span className="text-base text-muted-foreground">Loading...</span> : metric.value}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Weekly Order Trends</h2>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            <TrendingUp className="size-3.5" />
            Last 7 days
          </span>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
            Loading trends...
          </div>
        ) : (
          <ChartContainer config={weeklyOrdersChartConfig} className="h-64 w-full">
            <BarChart data={analytics?.weeklyTrends ?? []} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Bar dataKey="orders" fill="var(--color-orders)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </section>
    </>
  );
}

function VendorsSection({
  vendors,
  isLoading,
  onAddVendor,
  onManageVendor,
}: {
  vendors: AdminVendorRecord[];
  isLoading: boolean;
  onAddVendor: () => void;
  onManageVendor: (vendor: AdminVendorRecord) => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Vendors Management</h2>
          <p className="text-sm text-muted-foreground">Manage onboarding and zone availability</p>
        </div>
        <Button variant="hero" className="rounded-md" onClick={onAddVendor}>
          + Add New Vendor
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Vendor Name</th>
              <th className="px-4 py-3">Zone / Location</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  <AppEmptyState title="Loading vendors..." subtitle="Please wait while we sync records." className="border-0 bg-transparent py-2" />
                </td>
              </tr>
            ) : vendors.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  <AppEmptyState
                    title="No vendors yet."
                    subtitle="Add your first vendor to begin onboarding."
                    className="border-0 bg-transparent py-2"
                  />
                </td>
              </tr>
            ) : (
              vendors.map((vendor) => (
              <tr key={vendor.id} className="border-t border-border bg-card">
                <td className="px-4 py-3 font-medium text-foreground">
                  <div className="space-y-0.5">
                    <p>{vendor.storeName}</p>
                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="size-3" />
                      {vendor.ownerName}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    {vendor.zone}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      vendor.status === "Active"
                        ? "inline-flex rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success"
                        : "inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                    }
                  >
                    {vendor.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-2">
                    <Button variant="soft" size="sm" className="rounded-md" onClick={() => onManageVendor(vendor)}>
                      Manage
                    </Button>
                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="size-3" />
                      {vendor.phoneNumber}
                    </p>
                  </div>
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CyclistsSection({
  cyclists,
  isLoading,
  onAddCyclist,
}: {
  cyclists: AdminCyclistRecord[];
  isLoading: boolean;
  onAddCyclist: () => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Cyclists Management</h2>
          <p className="text-sm text-muted-foreground">Assign and manage neighborhood-level delivery riders.</p>
        </div>
        <Button variant="hero" className="rounded-md" onClick={onAddCyclist}>
          + Add New Cyclist
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Cyclist</th>
              <th className="px-4 py-3">Assigned Zone</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  <AppEmptyState title="Loading cyclists..." subtitle="Please wait while we sync records." className="border-0 bg-transparent py-2" />
                </td>
              </tr>
            ) : cyclists.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  <AppEmptyState
                    title="No cyclists yet."
                    subtitle="Add your first cyclist to dispatch deliveries."
                    className="border-0 bg-transparent py-2"
                  />
                </td>
              </tr>
            ) : (
              cyclists.map((cyclist) => (
                <tr key={cyclist.id} className="border-t border-border bg-card">
                  <td className="px-4 py-3 font-medium text-foreground">{cyclist.fullName}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5" />
                      {cyclist.zone}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="size-3.5" />
                      {cyclist.phoneNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        cyclist.status === "Active"
                          ? "inline-flex rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success"
                          : "inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {cyclist.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ServiceZonesSection({
  zones,
  isLoading,
  isRenamingCommuneId,
  isRenamingNeighborhoodId,
  form,
  onFormChange,
  onSaveCommune,
  onSaveNeighborhood,
  onEditCommune,
  onEditNeighborhood,
}: {
  zones: ServiceZoneTree;
  isLoading: boolean;
  isRenamingCommuneId: string | null;
  isRenamingNeighborhoodId: string | null;
  form: {
    communeName: string;
    neighborhoodCommuneId: string;
    neighborhoodName: string;
    neighborhoodDeliveryFee: string;
  };
  onFormChange: Dispatch<
    SetStateAction<{
      communeName: string;
      neighborhoodCommuneId: string;
      neighborhoodName: string;
      neighborhoodDeliveryFee: string;
    }>
  >;
  onSaveCommune: () => void;
  onSaveNeighborhood: () => void;
  onEditCommune: (communeId: string, currentName: string) => void;
  onEditNeighborhood: (neighborhoodId: string, currentName: string, currentDeliveryFee: number) => void;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Service Zones</h2>
        <p className="text-sm text-muted-foreground">Define communes and neighborhoods for strict routing.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-md border border-border bg-background p-3">
          <label htmlFor="new-commune" className="text-sm font-medium text-foreground">
            New Jamaa Tourabiya
          </label>
          <input
            id="new-commune"
            value={form.communeName}
            onChange={(event) => onFormChange((current) => ({ ...current, communeName: event.target.value }))}
            placeholder="e.g. Sidi Bernoussi"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          />
          <Button variant="hero" className="w-full rounded-md" onClick={onSaveCommune}>
            Add Commune
          </Button>
        </div>

        <div className="space-y-2 rounded-md border border-border bg-background p-3">
          <label htmlFor="neighborhood-commune" className="text-sm font-medium text-foreground">
            Commune for New Hay / Douar
          </label>
          <select
            id="neighborhood-commune"
            value={form.neighborhoodCommuneId}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                neighborhoodCommuneId: event.target.value,
              }))
            }
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          >
            <option value="">Select commune</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
          <input
            id="new-neighborhood"
            value={form.neighborhoodName}
            onChange={(event) => onFormChange((current) => ({ ...current, neighborhoodName: event.target.value }))}
            placeholder="e.g. Hay El Farah"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          />
          <input
            id="neighborhood-delivery-fee"
            type="number"
            min="0"
            step="0.01"
            value={form.neighborhoodDeliveryFee}
            onChange={(event) => onFormChange((current) => ({ ...current, neighborhoodDeliveryFee: event.target.value }))}
            placeholder="Delivery Fee (MAD)"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          />
          <Button variant="hero" className="w-full rounded-md" onClick={onSaveNeighborhood}>
            Add Neighborhood / Douar
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border">
        <div className="border-b border-border bg-muted/40 px-4 py-2 text-sm font-medium text-foreground">
          Configured Zones
        </div>
        {isLoading ? (
          <div className="p-4">
            <AppEmptyState title="Loading service zones..." subtitle="Fetching configured communes and neighborhoods." />
          </div>
        ) : zones.length === 0 ? (
          <div className="p-4">
            <AppEmptyState title="No service zones yet." subtitle="Create your first commune and neighborhood to start dispatching." />
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {zones.map((zone) => (
              <div key={zone.id} className="rounded-md border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{zone.name}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-md"
                    disabled={isRenamingCommuneId === zone.id}
                    onClick={() => onEditCommune(zone.id, zone.name)}
                  >
                    {isRenamingCommuneId === zone.id ? "Saving..." : "Edit"}
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {zone.neighborhoods.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No neighborhoods yet</span>
                  ) : (
                    zone.neighborhoods.map((neighborhood) => (
                      <div key={neighborhood.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-2 py-1">
                        <span className="text-xs text-foreground">{neighborhood.name} - {Number(neighborhood.deliveryFee ?? 0).toFixed(2)} MAD</span>
                        <button
                          type="button"
                          className="text-xs font-medium text-primary disabled:opacity-60"
                          disabled={isRenamingNeighborhoodId === neighborhood.id}
                          onClick={() => onEditNeighborhood(neighborhood.id, neighborhood.name, Number(neighborhood.deliveryFee ?? 0))}
                        >
                          {isRenamingNeighborhoodId === neighborhood.id ? "Saving..." : "Edit"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CatalogSection({
  products,
  categories,
  isLoading,
  onAddProduct,
  onEditProduct,
  onArchiveProduct,
}: {
  products: MasterProductEntity[];
  categories: CategoryAdminRow[];
  isLoading: boolean;
  onAddProduct: () => void;
  onEditProduct: (product: MasterProductEntity) => void;
  onArchiveProduct: (product: MasterProductEntity) => void;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Master Product List</h2>
          <p className="text-sm text-muted-foreground">
            Add standard grocery items once for shared vendor distribution.
          </p>
        </div>
        <Button variant="hero" className="rounded-md" onClick={onAddProduct}>
          + Add Master Product
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <AppEmptyState title="Loading products..." subtitle="Syncing the master product catalog." className="col-span-full" />
        ) : products.length === 0 ? (
          <AppEmptyState
            title="No master products yet."
            subtitle="Add your first shared product."
            className="col-span-full"
          />
        ) : (
          products.map((product) => {
            const categoryName = categories.find((category) => category.id === product.categoryId)?.name_en ?? product.category;

            return (
              <article key={product.id} className="rounded-md border border-border bg-background p-3 transition hover:-translate-y-0.5 hover:shadow-sm">
            <div className="mb-3 aspect-square overflow-hidden rounded-md border border-border bg-muted/40">
              <img
                src={product.imageUrl || fallbackProductImage}
                alt={`${product.name} product image`}
                className="h-full w-full object-contain object-center p-2"
                loading="lazy"
                width={480}
                height={240}
              />
            </div>
            <p className="font-medium text-foreground">{product.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{categoryName}</p>
            <p className="mt-2 text-sm font-semibold text-primary">Unit: {product.measurementUnit}</p>
            <div className="mt-3 flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" className="rounded-md" onClick={() => onEditProduct(product)}>
                Edit
              </Button>
              <Button type="button" size="sm" variant="destructive" className="rounded-md" onClick={() => onArchiveProduct(product)}>
                Archive
              </Button>
            </div>
          </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function CategoriesSection({
  categories,
  isLoading,
  form,
  onFormChange,
  onSave,
  onEdit,
  onReset,
  isSaving,
  imageInputRef,
  imagePreviewUrl,
  onImageChange,
}: {
  categories: CategoryAdminRow[];
  isLoading: boolean;
  form: {
    id: string;
    nameEn: string;
    nameFr: string;
    nameAr: string;
    imageUrl: string;
    iconName: CategoryIconName;
    accentColor: string;
    sortOrder: string;
    isActive: boolean;
  };
  onFormChange: Dispatch<
    SetStateAction<{
      id: string;
      nameEn: string;
      nameFr: string;
      nameAr: string;
      imageUrl: string;
      iconName: CategoryIconName;
      accentColor: string;
      sortOrder: string;
      isActive: boolean;
    }>
  >;
  onSave: () => void;
  onEdit: (category: CategoryAdminRow) => void;
  onReset: () => void;
  isSaving: boolean;
  imageInputRef: RefObject<HTMLInputElement | null>;
  imagePreviewUrl: string | null;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Categories</h2>
        <p className="text-sm text-muted-foreground">Manage multilingual sections for homepage and customer category pages.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-3 rounded-md border border-border bg-background p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-center transition hover:border-primary/60"
            >
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onImageChange}
              />
              {imagePreviewUrl ? (
                <img
                  src={imagePreviewUrl}
                  alt="Category image preview"
                  className="mx-auto aspect-square w-full max-w-[220px] rounded-md object-cover"
                />
              ) : (
                <span className="text-sm text-muted-foreground">Upload category cover</span>
              )}
            </button>

            <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-center">
              <div
                className="mx-auto flex aspect-square w-full max-w-[220px] items-center justify-center rounded-2xl"
                style={{ backgroundColor: form.accentColor || "#f3f4f6" }}
              >
                <CategoryIcon iconName={form.iconName} className="h-20 w-20 text-foreground" />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-foreground">Name (EN)</label>
              <input
                value={form.nameEn}
                onChange={(event) => onFormChange((current) => ({ ...current, nameEn: event.target.value }))}
                placeholder="e.g. Vegetables"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Name (FR)</label>
              <input
                value={form.nameFr}
                onChange={(event) => onFormChange((current) => ({ ...current, nameFr: event.target.value }))}
                placeholder="e.g. Légumes"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Name (AR)</label>
              <input
                value={form.nameAr}
                onChange={(event) => onFormChange((current) => ({ ...current, nameAr: event.target.value }))}
                placeholder="مثال: خضروات"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-foreground">Image URL (optional)</label>
              <input
                value={form.imageUrl}
                onChange={(event) => onFormChange((current) => ({ ...current, imageUrl: event.target.value }))}
                placeholder="https://..."
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-foreground">Category Icon</label>
              <Popover open={isIconPickerOpen} onOpenChange={setIsIconPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={isIconPickerOpen}
                    className="h-10 w-full justify-between rounded-md"
                  >
                    <span className="inline-flex items-center gap-2">
                      <CategoryIcon iconName={form.iconName} className="h-4 w-4" />
                      {form.iconName}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search icon..." />
                    <CommandList>
                      <CommandEmpty>No icon found.</CommandEmpty>
                      {CATEGORY_ICON_OPTIONS.map((iconName) => (
                        <CommandItem
                          key={iconName}
                          value={iconName}
                          onSelect={() => {
                            onFormChange((current) => ({ ...current, iconName }));
                            setIsIconPickerOpen(false);
                          }}
                        >
                          <CategoryIcon iconName={iconName} className="h-4 w-4" />
                          <span>{iconName}</span>
                          <span className={cn("ml-auto text-xs", form.iconName === iconName ? "text-primary" : "text-transparent")}>Selected</span>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Accent Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.accentColor}
                  onChange={(event) => onFormChange((current) => ({ ...current, accentColor: event.target.value }))}
                  className="h-10 w-12 rounded-md border border-input bg-background p-1"
                />
                <input
                  value={form.accentColor}
                  onChange={(event) => onFormChange((current) => ({ ...current, accentColor: event.target.value }))}
                  placeholder="#fef3c7"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(event) => onFormChange((current) => ({ ...current, sortOrder: event.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="flex items-end gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => onFormChange((current) => ({ ...current, isActive: checked }))}
              />
              <span className="text-sm text-foreground">Active</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="hero" className="rounded-md" onClick={onSave} disabled={isSaving}>
              {isSaving ? "Saving..." : form.id ? "Update Category" : "Add Category"}
            </Button>
            <Button type="button" variant="outline" className="rounded-md" onClick={onReset}>
              Reset
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-border bg-background p-3">
          <h3 className="text-sm font-semibold text-foreground">Saved Categories</h3>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading categories...</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <article key={category.id} className="flex items-center gap-3 rounded-md border border-border bg-card p-2">
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: category.accent_color || "#f3f4f6" }}
                  >
                    {category.image_url ? (
                      <img
                        src={category.image_url || fallbackProductImage}
                        alt={`${category.name_en} category icon`}
                        className="h-10 w-10 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <CategoryIcon iconName={category.icon_name} className="h-10 w-10 text-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{category.name_en}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {category.name_fr} • {category.name_ar}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Sort: {category.sort_order}</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" className="rounded-md" onClick={() => onEdit(category)}>
                    Edit
                  </Button>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AdsContentSection({
  ads,
  announcements,
  isLoading,
  adForm,
  onAdFormChange,
  onSaveAd,
  onEditAd,
  onDeleteAd,
  onResetAdForm,
  isSavingAd,
  adImageInputRef,
  adImagePreviewUrl,
  onAdImageChange,
  announcementForm,
  onAnnouncementFormChange,
  onSaveAnnouncement,
  onEditAnnouncement,
  onDeleteAnnouncement,
  onResetAnnouncementForm,
  isSavingAnnouncement,
}: {
  ads: Array<{
    id: string;
    image_url: string;
    link_url: string | null;
    sort_order: number;
    is_active: boolean;
    created_at: string;
  }>;
  announcements: Array<{
    id: string;
    content: string;
    content_fr: string | null;
    content_ar: string | null;
    is_active: boolean;
    bg_color: string;
    text_color: string;
    created_at: string;
  }>;
  isLoading: boolean;
  adForm: {
    id: string;
    imageUrl: string;
    linkUrl: string;
    sortOrder: string;
    isActive: boolean;
  };
  onAdFormChange: Dispatch<
    SetStateAction<{
      id: string;
      imageUrl: string;
      linkUrl: string;
      sortOrder: string;
      isActive: boolean;
    }>
  >;
  onSaveAd: () => void;
  onEditAd: (ad: {
    id: string;
    image_url: string;
    link_url: string | null;
    sort_order: number;
    is_active: boolean;
  }) => void;
  onDeleteAd: (id: string) => void;
  onResetAdForm: () => void;
  isSavingAd: boolean;
  adImageInputRef: RefObject<HTMLInputElement | null>;
  adImagePreviewUrl: string | null;
  onAdImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  announcementForm: {
    id: string;
    content: string;
    contentFr: string;
    contentAr: string;
    isActive: boolean;
    bgColor: string;
    textColor: string;
  };
  onAnnouncementFormChange: Dispatch<
    SetStateAction<{
      id: string;
      content: string;
      contentFr: string;
      contentAr: string;
      isActive: boolean;
      bgColor: string;
      textColor: string;
    }>
  >;
  onSaveAnnouncement: () => void;
  onEditAnnouncement: (announcement: {
    id: string;
    content: string;
    content_fr: string | null;
    content_ar: string | null;
    is_active: boolean;
    bg_color: string;
    text_color: string;
  }) => void;
  onDeleteAnnouncement: (id: string) => void;
  onResetAnnouncementForm: () => void;
  isSavingAnnouncement: boolean;
}) {
  const { t } = useTranslation();

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Ads & Content</h2>
        <p className="text-sm text-muted-foreground">Manage homepage banners and global scrolling ticker content.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-md border border-border bg-background p-3">
          <h3 className="text-sm font-semibold text-foreground">Ads Manager</h3>
          <button
            type="button"
            onClick={() => adImageInputRef.current?.click()}
            className="w-full rounded-md border border-dashed border-border bg-muted/40 p-3 text-center transition hover:border-primary/60"
          >
            <input
              ref={adImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onAdImageChange}
            />
            {adImagePreviewUrl ? (
              <img
                src={adImagePreviewUrl}
                alt="Selected ad preview"
                className="mx-auto h-28 w-full rounded-md border border-border bg-muted/30 object-cover"
              />
            ) : (
              <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ImagePlus className="size-5" />
              </span>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Upload ad image (optional if URL already set)</p>
          </button>

          <input
            value={adForm.imageUrl}
            onChange={(event) => onAdFormChange((current) => ({ ...current, imageUrl: event.target.value }))}
            placeholder="https://...ad-image.jpg"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          />
          <input
            value={adForm.linkUrl}
            onChange={(event) => onAdFormChange((current) => ({ ...current, linkUrl: event.target.value }))}
            placeholder="Optional target URL"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          />
          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
            <input
              type="number"
              min={0}
              value={adForm.sortOrder}
              onChange={(event) => onAdFormChange((current) => ({ ...current, sortOrder: event.target.value }))}
              placeholder="Sort order"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Active</span>
              <Switch
                checked={adForm.isActive}
                onCheckedChange={(checked) => onAdFormChange((current) => ({ ...current, isActive: checked }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="hero" className="rounded-md" onClick={onSaveAd} disabled={isSavingAd}>
              {isSavingAd ? "Saving..." : adForm.id ? "Update Ad" : "Create Ad"}
            </Button>
            <Button variant="outline" className="rounded-md" onClick={onResetAdForm}>
              Reset
            </Button>
          </div>

          <div className="max-h-64 space-y-2 overflow-auto rounded-md border border-border p-2">
            {isLoading ? (
              <p className="text-xs text-muted-foreground">Loading ads...</p>
            ) : ads.length === 0 ? (
              <p className="text-xs text-muted-foreground">No ads configured yet.</p>
            ) : (
              ads.map((ad) => (
                <article key={ad.id} className="rounded-md border border-border bg-card p-2">
                  <img
                    src={ad.image_url}
                    alt="Homepage ad preview"
                    className="h-20 w-full rounded-md object-cover"
                    loading="lazy"
                  />
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Order #{ad.sort_order}</span>
                    <span>{ad.is_active ? "Active" : "Disabled"}</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button type="button" size="sm" variant="outline" className="rounded-md" onClick={() => onEditAd(ad)}>
                      Edit
                    </Button>
                    <Button type="button" size="sm" variant="destructive" className="rounded-md" onClick={() => onDeleteAd(ad.id)}>
                      Delete
                    </Button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-border bg-background p-3">
          <h3 className="text-sm font-semibold text-foreground">Ticker Manager</h3>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>{t("admin.tickerEn")}</span>
            <textarea
              value={announcementForm.content}
              onChange={(event) =>
                onAnnouncementFormChange((current) => ({
                  ...current,
                  content: event.target.value,
                }))
              }
              placeholder="Write a global announcement"
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
            />
          </label>

          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>{t("admin.tickerFr")}</span>
            <textarea
              value={announcementForm.contentFr}
              onChange={(event) =>
                onAnnouncementFormChange((current) => ({
                  ...current,
                  contentFr: event.target.value,
                }))
              }
              placeholder="Écrivez un message global"
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
            />
          </label>

          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>{t("admin.tickerAr")}</span>
            <textarea
              value={announcementForm.contentAr}
              onChange={(event) =>
                onAnnouncementFormChange((current) => ({
                  ...current,
                  contentAr: event.target.value,
                }))
              }
              placeholder="اكتب إعلانًا عامًا"
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={announcementForm.bgColor}
              onChange={(event) =>
                onAnnouncementFormChange((current) => ({ ...current, bgColor: event.target.value }))
              }
              placeholder="#deff9a"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
            />
            <input
              value={announcementForm.textColor}
              onChange={(event) =>
                onAnnouncementFormChange((current) => ({ ...current, textColor: event.target.value }))
              }
              placeholder="#000000"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Active</span>
            <Switch
              checked={announcementForm.isActive}
              onCheckedChange={(checked) =>
                onAnnouncementFormChange((current) => ({
                  ...current,
                  isActive: checked,
                }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="hero" className="rounded-md" onClick={onSaveAnnouncement} disabled={isSavingAnnouncement}>
              {isSavingAnnouncement
                ? "Saving..."
                : announcementForm.id
                  ? "Update Message"
                  : "Create Message"}
            </Button>
            <Button variant="outline" className="rounded-md" onClick={onResetAnnouncementForm}>
              Reset
            </Button>
          </div>

          <div className="max-h-64 space-y-2 overflow-auto rounded-md border border-border p-2">
            {isLoading ? (
              <p className="text-xs text-muted-foreground">Loading announcements...</p>
            ) : announcements.length === 0 ? (
              <p className="text-xs text-muted-foreground">No announcements configured yet.</p>
            ) : (
              announcements.map((announcement) => (
                <article key={announcement.id} className="rounded-md border border-border bg-card p-2">
                  <div
                    className="rounded-md px-2 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: announcement.bg_color,
                      color: announcement.text_color,
                    }}
                  >
                    EN: {announcement.content}
                    <br />
                    FR: {announcement.content_fr ?? announcement.content}
                    <br />
                    AR: {announcement.content_ar ?? announcement.content}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{announcement.is_active ? "Active" : "Disabled"}</span>
                    <span>{new Date(announcement.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-md"
                      onClick={() => onEditAnnouncement(announcement)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="rounded-md"
                      onClick={() => onDeleteAnnouncement(announcement.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function OrdersSection({
  orders,
  isLoading,
  error,
  statusFilter,
  onStatusFilterChange,
}: {
  orders: Array<{
    id: string;
    createdAt: string;
    vendorName: string;
    customerPhone: string;
    totalPrice: number;
    status: "new" | "preparing" | "ready" | "delivering" | "delivered" | "cancelled";
  }>;
  isLoading: boolean;
  error: Error | null;
  statusFilter: "all" | "new" | "preparing" | "ready" | "delivering" | "delivered";
  onStatusFilterChange: Dispatch<
    SetStateAction<"all" | "new" | "preparing" | "ready" | "delivering" | "delivered">
  >;
}) {
  const statusBadgeClass: Record<string, string> = {
    new: "bg-chart-4/15 text-chart-4",
    preparing: "bg-highlight/25 text-highlight-foreground",
    ready: "bg-chart-2/20 text-foreground",
    delivering: "bg-primary/15 text-primary",
    delivered: "bg-success/15 text-success",
    cancelled: "bg-destructive/15 text-destructive",
  };

  if (error) {
    return (
      <section className="rounded-lg border border-destructive/40 bg-destructive/10 p-5 text-destructive shadow-sm">
        Failed to load global orders.
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Global Orders Monitoring</h2>
          <p className="text-sm text-muted-foreground">Live marketplace orders with vendor attribution.</p>
        </div>
        <select
          value={statusFilter}
          onChange={(event) =>
            onStatusFilterChange(
              event.target.value as "all" | "new" | "preparing" | "ready" | "delivering" | "delivered",
            )
          }
          className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
        >
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="preparing">Preparing</option>
          <option value="ready">Ready</option>
          <option value="delivering">Dispatched</option>
          <option value="delivered">Delivered</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Order ID</th>
              <th className="px-4 py-3">Date & Time</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Customer Phone</th>
              <th className="px-4 py-3">Total Price</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Loading orders...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No orders found for the selected filter.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-t border-border bg-card">
                  <td className="px-4 py-3 font-medium text-foreground">#{order.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-foreground">{order.vendorName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{order.customerPhone}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{Math.round(order.totalPrice)} MAD</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass[order.status] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CustomersSection({
  customers,
  isLoading,
  error,
}: {
  customers: Array<{
    id: string;
    fullName: string;
    phone: string;
    address: string;
    joinedAt: string;
    totalOrders: number;
    ltvMad: number;
  }>;
  isLoading: boolean;
  error: Error | null;
}) {
  if (error) {
    return (
      <section className="rounded-lg border border-destructive/40 bg-destructive/10 p-5 text-destructive shadow-sm">
        Failed to load customers.
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Customers CRM</h2>
        <p className="text-sm text-muted-foreground">Registered customer profiles and purchase value.</p>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">Joined Date</th>
              <th className="px-4 py-3">Total Orders</th>
              <th className="px-4 py-3">LTV</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Loading customers...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No customers yet.
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="border-t border-border bg-card">
                  <td className="px-4 py-3 font-medium text-foreground">{customer.fullName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{customer.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground">{customer.address}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(customer.joinedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-foreground">{customer.totalOrders}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{customer.ltvMad.toFixed(2)} MAD</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SettingsSection({
  form,
  onFormChange,
  onSaveGlobalSettings,
  isGlobalSettingsLoading,
  receiptForm,
  onReceiptFormChange,
  onSaveReceiptSettings,
  isReceiptSettingsLoading,
}: {
  form: {
    id: string;
    deliveryFeeMad: string;
    minimumOrderMad: string;
    freeDeliveryThresholdMad: string;
    marketplaceActive: boolean;
  };
  onFormChange: Dispatch<
    SetStateAction<{
      id: string;
      deliveryFeeMad: string;
      minimumOrderMad: string;
      freeDeliveryThresholdMad: string;
      marketplaceActive: boolean;
    }>
  >;
  onSaveGlobalSettings: () => Promise<void>;
  isGlobalSettingsLoading: boolean;
  receiptForm: {
    id: string;
    storeName: string;
    address: string;
    phone: string;
    taxId: string;
    footerMessage: string;
  };
  onReceiptFormChange: Dispatch<
    SetStateAction<{
      id: string;
      storeName: string;
      address: string;
      phone: string;
      taxId: string;
      footerMessage: string;
    }>
  >;
  onSaveReceiptSettings: () => Promise<void>;
  isReceiptSettingsLoading: boolean;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Global Configuration</h2>
        <p className="text-sm text-muted-foreground">Set default marketplace-level operational parameters.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="delivery-fee" className="text-sm font-medium text-foreground">
            Global Delivery Fee (MAD)
          </label>
          <input
            id="delivery-fee"
            type="number"
            min={0}
            value={form.deliveryFeeMad}
            onChange={(event) => onFormChange((current) => ({ ...current, deliveryFeeMad: event.target.value }))}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="minimum-order" className="text-sm font-medium text-foreground">
            Minimum Order Amount (MAD)
          </label>
          <input
            id="minimum-order"
            type="number"
            min={0}
            value={form.minimumOrderMad}
            onChange={(event) => onFormChange((current) => ({ ...current, minimumOrderMad: event.target.value }))}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="free-delivery-threshold" className="text-sm font-medium text-foreground">
            Free Delivery Threshold (MAD) · عتبة التوصيل المجاني
          </label>
          <input
            id="free-delivery-threshold"
            type="number"
            min={0}
            value={form.freeDeliveryThresholdMad}
            onChange={(event) => onFormChange((current) => ({ ...current, freeDeliveryThresholdMad: event.target.value }))}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </div>

      <div className="rounded-md border border-border bg-background p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Marketplace Status</p>
            <p className="text-xs text-muted-foreground">
              {form.marketplaceActive ? "Active" : "Maintenance Mode"}
            </p>
          </div>
          <Switch
            checked={form.marketplaceActive}
            onCheckedChange={(checked) => onFormChange((current) => ({ ...current, marketplaceActive: checked }))}
          />
        </div>
      </div>

      <Button
        variant="hero"
        className="rounded-md"
        onClick={() => {
          void onSaveGlobalSettings();
        }}
        disabled={isGlobalSettingsLoading || !form.id}
      >
        {isGlobalSettingsLoading ? "Saving Global Settings..." : "Save Changes"}
      </Button>

      <div className="mt-2 h-px w-full bg-border" />

      <div>
        <h3 className="text-base font-semibold text-foreground">Receipt Settings</h3>
        <p className="text-sm text-muted-foreground">Configure thermal receipt header and footer details.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="receipt-store-name" className="text-sm font-medium text-foreground">
            Store Name
          </label>
          <Input
            id="receipt-store-name"
            value={receiptForm.storeName}
            onChange={(event) => onReceiptFormChange((current) => ({ ...current, storeName: event.target.value }))}
            className="h-10 rounded-md"
            placeholder="Bzaf Fresh"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="receipt-phone" className="text-sm font-medium text-foreground">
            Phone
          </label>
          <Input
            id="receipt-phone"
            value={receiptForm.phone}
            onChange={(event) => onReceiptFormChange((current) => ({ ...current, phone: event.target.value }))}
            className="h-10 rounded-md"
            placeholder="+212XXXXXXXXX"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="receipt-address" className="text-sm font-medium text-foreground">
            Address
          </label>
          <Input
            id="receipt-address"
            value={receiptForm.address}
            onChange={(event) => onReceiptFormChange((current) => ({ ...current, address: event.target.value }))}
            className="h-10 rounded-md"
            placeholder="Casablanca, Morocco"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="receipt-tax-id" className="text-sm font-medium text-foreground">
            Tax / ICE ID (Optional)
          </label>
          <Input
            id="receipt-tax-id"
            value={receiptForm.taxId}
            onChange={(event) => onReceiptFormChange((current) => ({ ...current, taxId: event.target.value }))}
            className="h-10 rounded-md"
            placeholder="ICE123456789"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="receipt-footer" className="text-sm font-medium text-foreground">
            Footer Message
          </label>
          <Textarea
            id="receipt-footer"
            value={receiptForm.footerMessage}
            onChange={(event) => onReceiptFormChange((current) => ({ ...current, footerMessage: event.target.value }))}
            className="min-h-20 rounded-md"
            placeholder="Thank you for shopping with Bzaf Fresh!"
          />
        </div>
      </div>

      <Button
        variant="hero"
        className="rounded-md"
        onClick={() => {
          void onSaveReceiptSettings();
        }}
        disabled={isReceiptSettingsLoading || !receiptForm.id}
      >
        {isReceiptSettingsLoading ? "Saving Receipt Settings..." : "Save Receipt Settings"}
      </Button>
    </section>
  );
}