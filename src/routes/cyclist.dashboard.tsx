import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Bike, Camera, CheckCircle2, Keyboard, Lock, LogOut, PackageSearch, PhoneCall, Truck, Volume2, VolumeX, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState as AppEmptyState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import {
  acceptDeliveryRun,
  getCyclistDashboardData,
  setCyclistActiveState,
  type CyclistOrderCard,
  verifyDeliveryCodeAndComplete,
} from "@/lib/cyclists.functions";
import { playActionSound } from "@/lib/sound-alerts";

const CYCLIST_SESSION_STORAGE_KEY = "bzaf.cyclistSession";
const CYCLIST_SOUNDS_STORAGE_KEY = "bzaf.cyclistSoundsEnabled";

type CyclistView = "available" | "active";
type CyclistSession = {
  cyclistId: string;
  phoneNumber: string;
  fullName: string;
};

export const Route = createFileRoute("/cyclist/dashboard")({
  head: () => ({
    meta: [
      { title: "Cyclist Dashboard | Bzaf Fresh" },
      {
        name: "description",
        content: "Mobile-first cyclist dashboard for accepting runs and completing local deliveries.",
      },
    ],
  }),
  component: CyclistDashboardPage,
});

function CyclistDashboardPage() {
  const navigate = useNavigate({ from: "/cyclist/dashboard" });
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<CyclistView>("available");
  const [isUpdatingOrderId, setIsUpdatingOrderId] = useState<string | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const [hasAudioPermissionHintShown, setHasAudioPermissionHintShown] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerOrder, setScannerOrder] = useState<CyclistOrderCard | null>(null);
  const [scannerStatus, setScannerStatus] = useState("Ready to scan.");
  const [manualCode, setManualCode] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [isScannerSuccess, setIsScannerSuccess] = useState(false);
  const previousAvailableRunIdsRef = useRef<Set<string>>(new Set());
  const hasInitializedRunsRef = useRef(false);
  const qrScannerRef = useRef<any>(null);
  const isVerifyingCodeRef = useRef(false);
  const [session] = useState<CyclistSession | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const raw = localStorage.getItem(CYCLIST_SESSION_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as CyclistSession;
      if (!parsed?.cyclistId || !parsed?.fullName || !parsed?.phoneNumber) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const fetchDashboardData = useServerFn(getCyclistDashboardData);
  const setActiveState = useServerFn(setCyclistActiveState);
  const acceptRun = useServerFn(acceptDeliveryRun);
  const verifyDeliveryCode = useServerFn(verifyDeliveryCodeAndComplete);

  const dashboardQuery = useQuery({
    queryKey: ["cyclist", "dashboard", session?.cyclistId ?? null],
    enabled: Boolean(session?.cyclistId),
    queryFn: () => fetchDashboardData({ data: { cyclistId: session!.cyclistId } }),
    refetchInterval: session?.cyclistId ? 4_000 : false,
  });

  const cyclist = dashboardQuery.data?.cyclist;
  const availableRuns = dashboardQuery.data?.availableRuns ?? [];
  const activeDeliveries = dashboardQuery.data?.activeDeliveries ?? [];
  const hasActiveDeliveryLock = activeDeliveries.length > 0;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsSoundEnabled(localStorage.getItem(CYCLIST_SOUNDS_STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    const currentAvailableRunIds = new Set(availableRuns.map((order) => order.id));

    if (!hasInitializedRunsRef.current) {
      previousAvailableRunIdsRef.current.clear();
      currentAvailableRunIds.forEach((id) => previousAvailableRunIdsRef.current.add(id));
      hasInitializedRunsRef.current = true;
      return;
    }

    const hasNewReadyRun = Array.from(currentAvailableRunIds).some(
      (id) => !previousAvailableRunIdsRef.current.has(id),
    );
    previousAvailableRunIdsRef.current.clear();
    currentAvailableRunIds.forEach((id) => previousAvailableRunIdsRef.current.add(id));

    if (!hasNewReadyRun || !isSoundEnabled) {
      return;
    }

    void playActionSound({ enabled: true }).then((played) => {
      if (!played && !hasAudioPermissionHintShown) {
        toast.info("Click the sound icon to allow pickup alerts in your browser.");
        setHasAudioPermissionHintShown(true);
      }
    });
  }, [availableRuns, isSoundEnabled, hasAudioPermissionHintShown]);

  const handleToggleSounds = async () => {
    const nextEnabled = !isSoundEnabled;
    setIsSoundEnabled(nextEnabled);

    if (typeof window !== "undefined") {
      localStorage.setItem(CYCLIST_SOUNDS_STORAGE_KEY, nextEnabled ? "1" : "0");
    }

    if (!nextEnabled) {
      toast.success("Sounds disabled.");
      return;
    }

    const played = await playActionSound({ enabled: true });
    if (!played) {
      toast.error("Browser blocked autoplay. Tap again after interacting with the page.");
      return;
    }

    toast.success("Sounds enabled.");
  };

  const onlineCountLabel = useMemo(() => {
    if (activeView === "available") {
      return `${availableRuns.length} available run${availableRuns.length === 1 ? "" : "s"}`;
    }
    return `${activeDeliveries.length} active deliver${activeDeliveries.length === 1 ? "y" : "ies"}`;
  }, [activeView, availableRuns.length, activeDeliveries.length]);

  const updateOnlineState = async (isOnline: boolean) => {
    if (!cyclist?.id) {
      return;
    }

    try {
      queryClient.setQueryData(["cyclist", "dashboard", session?.cyclistId ?? null], (current: any) =>
        current
          ? {
              ...current,
              cyclist: {
                ...current.cyclist,
                isActive: isOnline,
              },
            }
          : current,
      );

      await setActiveState({ data: { cyclistId: cyclist.id, isActive: isOnline } });
      toast.success(isOnline ? "You are online." : "You are offline.");
    } catch (error) {
      console.error("Failed to update cyclist online state:", error);
      await dashboardQuery.refetch();
      toast.error("Failed to update online status.");
    }
  };

  const handleAcceptDelivery = async (order: CyclistOrderCard) => {
    if (!session?.cyclistId) {
      return;
    }

    setIsUpdatingOrderId(order.id);
    try {
      queryClient.setQueryData(["cyclist", "dashboard", session.cyclistId], (current: any) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          availableRuns: (current.availableRuns as CyclistOrderCard[]).filter((run) => run.id !== order.id),
          activeDeliveries: [order, ...(current.activeDeliveries as CyclistOrderCard[])],
        };
      });

      await acceptRun({ data: { cyclistId: session.cyclistId, orderId: order.id } });
      toast.success("Delivery accepted.");
      await dashboardQuery.refetch();
    } catch (error) {
      console.error("Failed to accept delivery:", error);
      await dashboardQuery.refetch();
      toast.error(error instanceof Error ? error.message : "Failed to accept delivery.");
    } finally {
      setIsUpdatingOrderId(null);
    }
  };

  const extractDeliveryCode = (rawValue: string, orderId: string) => {
    const trimmed = rawValue.trim();
    if (/^\d{4,6}$/.test(trimmed)) {
      return trimmed;
    }

    try {
      const parsed = JSON.parse(trimmed) as { orderId?: string; code?: string };
      if (parsed.orderId !== orderId) {
        return null;
      }
      if (typeof parsed.code !== "string") {
        return null;
      }
      const code = parsed.code.trim();
      return /^\d{4,6}$/.test(code) ? code : null;
    } catch {
      return null;
    }
  };

  const closeScanner = () => {
    setIsScannerOpen(false);
    setScannerOrder(null);
    setManualCode("");
    setShowManualEntry(false);
    setIsScannerSuccess(false);
    setScannerStatus("Ready to scan.");
    isVerifyingCodeRef.current = false;
  };

  const handleVerifyDeliveryCode = async (order: CyclistOrderCard, rawValue: string) => {
    if (!session?.cyclistId || isVerifyingCodeRef.current) {
      return;
    }

    const extractedCode = extractDeliveryCode(rawValue, order.id);
    if (!extractedCode) {
      toast.error("Invalid QR/PIN format.");
      return;
    }

    isVerifyingCodeRef.current = true;
    setIsUpdatingOrderId(order.id);
    setScannerStatus("Verifying delivery pass...");

    try {
      queryClient.setQueryData(["cyclist", "dashboard", session.cyclistId], (current: any) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          activeDeliveries: (current.activeDeliveries as CyclistOrderCard[]).filter(
            (delivery) => delivery.id !== order.id,
          ),
        };
      });

      await verifyDeliveryCode({
        data: {
          cyclistId: session.cyclistId,
          orderId: order.id,
          deliveryAuthCode: extractedCode,
        },
      });

      setIsScannerSuccess(true);
      setScannerStatus("Delivery verified successfully.");
      toast.success("Delivery completed successfully.");
      await dashboardQuery.refetch();
      window.setTimeout(() => closeScanner(), 900);
    } catch (error) {
      console.error("Failed to verify delivery:", error);
      await dashboardQuery.refetch();
      setScannerStatus("Verification failed. Try scanning again or use manual code.");
      toast.error(error instanceof Error ? error.message : "Failed to verify delivery.");
      isVerifyingCodeRef.current = false;
    } finally {
      setIsUpdatingOrderId(null);
    }
  };

  const openScannerForOrder = (order: CyclistOrderCard) => {
    setScannerOrder(order);
    setManualCode("");
    setShowManualEntry(false);
    setIsScannerSuccess(false);
    setScannerStatus("Preparing camera...");
    setIsScannerOpen(true);
  };

  useEffect(() => {
    if (!isScannerOpen || !scannerOrder || showManualEntry || isScannerSuccess) {
      return;
    }

    let mounted = true;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        if (!mounted) {
          return;
        }

        const scanner = new Html5Qrcode("delivery-qr-reader");
        qrScannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText: string) => {
            void handleVerifyDeliveryCode(scannerOrder, decodedText);
          },
          () => undefined,
        );

        if (mounted) {
          setScannerStatus("Point your camera at the customer QR code.");
        }
      } catch (error) {
        console.error("QR camera permission/start failed:", error);
        if (mounted) {
          setShowManualEntry(true);
          setScannerStatus("Camera unavailable. Enter code manually.");
        }
      }
    };

    void startScanner();

    return () => {
      mounted = false;
      const scanner = qrScannerRef.current;
      qrScannerRef.current = null;
      if (scanner) {
        void scanner
          .stop()
          .catch(() => undefined)
          .finally(() => {
            void scanner.clear().catch(() => undefined);
          });
      }
    };
  }, [isScannerOpen, scannerOrder, showManualEntry, isScannerSuccess]);

  const handleManualVerify = async () => {
    if (!scannerOrder) {
      return;
    }
    await handleVerifyDeliveryCode(scannerOrder, manualCode);
  };

  const handleLogout = async () => {
    localStorage.removeItem(CYCLIST_SESSION_STORAGE_KEY);
    toast.success("Logged out successfully.");
    await navigate({ to: "/cyclist/login" });
  };

  if (!session?.cyclistId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Your cyclist session has expired.</p>
          <Button className="w-full" onClick={() => navigate({ to: "/cyclist/login" })}>
            Go to Login
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/20 pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <Bike className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{cyclist?.fullName ?? session.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">Cyclist Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
            <Button size="icon" variant="soft" className="rounded-xl" onClick={handleLogout}>
              <LogOut className="size-4" />
            </Button>
            <Button size="icon" variant="soft" className="rounded-xl" onClick={() => navigate({ to: "/cyclist/wallet" })}>
              <Wallet className="size-4" />
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-3 flex w-full max-w-lg items-center justify-between rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
          <span className="text-sm text-muted-foreground">{cyclist?.isActive ? "Online" : "Offline"}</span>
          <Switch checked={Boolean(cyclist?.isActive)} onCheckedChange={updateOnlineState} />
        </div>
      </header>

      <section className="mx-auto w-full max-w-lg px-4 pt-4">
        <div className="mb-4 inline-flex w-full items-center rounded-xl border border-border bg-card p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveView("available")}
            className={`h-10 flex-1 rounded-lg text-sm font-medium transition ${
              activeView === "available"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Available Runs
          </button>
          <button
            type="button"
            onClick={() => setActiveView("active")}
            className={`h-10 flex-1 rounded-lg text-sm font-medium transition ${
              activeView === "active"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Active Deliveries
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">{onlineCountLabel}</p>
          {dashboardQuery.isLoading ? <p className="text-xs text-muted-foreground">Refreshing…</p> : null}
        </div>

        {activeView === "available" ? (
          <div className="space-y-3">
            {hasActiveDeliveryLock ? (
              <AppEmptyState
                title="Finish your current run! (كمل التوصيلة اللي فـ يدك أولاً!)"
                subtitle="You have an active delivery in progress. Complete it to unlock new available runs."
                icon={Lock}
                className="bg-card"
              />
            ) : availableRuns.length === 0 ? (
              <EmptyState label="No ready deliveries in your neighborhood right now." />
            ) : (
              availableRuns.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  actionLabel="Accept & Pick Up"
                  actionTone="primary"
                  actionIcon={Truck}
                  isBusy={isUpdatingOrderId === order.id}
                  onAction={() => handleAcceptDelivery(order)}
                />
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {activeDeliveries.length === 0 ? (
              <EmptyState label="No active deliveries assigned to you." />
            ) : (
              activeDeliveries.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  actionLabel="Scan to Deliver (مسح الرمز للتسليم)"
                  actionTone="success"
                  actionIcon={Camera}
                  isBusy={isUpdatingOrderId === order.id}
                  onAction={() => openScannerForOrder(order)}
                />
              ))
            )}
          </div>
        )}
      </section>

      <Dialog open={isScannerOpen} onOpenChange={(open) => (!open ? closeScanner() : undefined)}>
        <DialogContent className="h-[92vh] w-[96vw] max-w-lg overflow-hidden rounded-2xl p-0">
          <DialogHeader className="border-b border-border px-4 py-3">
            <DialogTitle className="text-base font-semibold">Scan to Deliver</DialogTitle>
          </DialogHeader>

          <div className="flex h-full flex-col gap-3 p-4">
            {isScannerSuccess ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <span className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-success/15 text-success">
                  <CheckCircle2 className="size-10" />
                </span>
                <p className="mt-4 text-lg font-semibold text-foreground">Delivery Verified</p>
                <p className="mt-1 text-sm text-muted-foreground">Order status changed to delivered.</p>
              </div>
            ) : showManualEntry ? (
              <div className="flex flex-1 flex-col justify-center gap-4">
                <div className="space-y-2 rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-medium text-foreground">Enter customer delivery PIN</p>
                  <input
                    value={manualCode}
                    onChange={(event) => setManualCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="4-6 digit code"
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-center text-base tracking-wide outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-ring/30"
                  />
                  <Button
                    className="h-11 w-full rounded-xl"
                    onClick={handleManualVerify}
                    disabled={!scannerOrder || manualCode.length < 4 || isUpdatingOrderId === scannerOrder.id}
                  >
                    {isUpdatingOrderId === scannerOrder?.id ? "Verifying..." : "Verify & Deliver"}
                  </Button>
                </div>
                <Button variant="soft" className="h-10 rounded-xl" onClick={() => setShowManualEntry(false)}>
                  <Camera className="size-4" />
                  Back to Camera
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-2xl border border-border bg-black/90 p-2">
                  <div id="delivery-qr-reader" className="min-h-[340px] w-full" />
                </div>
                <Button variant="soft" className="h-10 rounded-xl" onClick={() => setShowManualEntry(true)}>
                  <Keyboard className="size-4" />
                  Enter Code Manually (إدخال الرمز يدوياً)
                </Button>
              </>
            )}

            <p className="text-center text-xs text-muted-foreground">{scannerStatus}</p>
          </div>
        </DialogContent>
      </Dialog>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto grid w-full max-w-lg grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveView("available")}
            className={`h-11 rounded-xl text-sm font-medium transition ${
              activeView === "available"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground"
            }`}
          >
            Available Runs
          </button>
          <button
            type="button"
            onClick={() => setActiveView("active")}
            className={`h-11 rounded-xl text-sm font-medium transition ${
              activeView === "active"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground"
            }`}
          >
            Active Deliveries
          </button>
        </div>
      </nav>
    </main>
  );
}

function OrderCard({
  order,
  actionLabel,
  actionTone,
  actionIcon: ActionIcon,
  isBusy,
  onAction,
}: {
  order: CyclistOrderCard;
  actionLabel: string;
  actionTone: "primary" | "success";
  actionIcon: typeof Truck;
  isBusy: boolean;
  onAction: () => void;
}) {
  const actionClass =
    actionTone === "success"
      ? "bg-success text-success-foreground hover:bg-success/90"
      : "bg-primary text-primary-foreground hover:bg-primary/90";

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="space-y-2">
        {order.paymentMethod === "Carnet" ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/15 p-3">
            <p className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-destructive">
              <AlertTriangle className="size-4" />
              CREDIT ORDER - DO NOT COLLECT CASH
            </p>
          </div>
        ) : null}
        <p className="text-sm font-semibold text-foreground">{order.customerName}</p>
        <a
          href={`tel:${order.customerPhone}`}
          className="inline-flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
        >
          <PhoneCall className="size-4" />
          {order.customerPhone}
        </a>
        <p className="text-sm text-muted-foreground">Douar: {order.douar}</p>
        <p className="text-sm font-medium text-foreground">Total: {order.totalMad.toFixed(2)} MAD</p>
        <p className="text-xs text-muted-foreground">Delivery notes: {order.deliveryNotes || "—"}</p>
        <p className="text-xs text-muted-foreground">Saved instructions: {order.savedInstructions || "—"}</p>
      </div>

      <Button className={`mt-4 h-11 w-full rounded-xl text-base font-semibold ${actionClass}`} onClick={onAction} disabled={isBusy}>
        <ActionIcon className="size-4" />
        {isBusy ? "Updating..." : actionLabel}
      </Button>
    </article>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <AppEmptyState
      title={label}
      subtitle="New delivery tasks will appear here automatically."
      icon={PackageSearch}
      className="bg-card"
    />
  );
}
