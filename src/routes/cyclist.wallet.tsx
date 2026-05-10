import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, HandCoins, History, Wallet } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getCyclistEarningsHistory, getCyclistWalletSummary } from "@/lib/cyclists.functions";

const CYCLIST_SESSION_STORAGE_KEY = "bzaf.cyclistSession";

type CyclistSession = {
  cyclistId: string;
  fullName: string;
  phoneNumber: string;
};

type EarningsPeriod = "today" | "week" | "month";

export const Route = createFileRoute("/cyclist/wallet")({
  component: CyclistWalletPage,
});

function CyclistWalletPage() {
  const navigate = useNavigate({ from: "/cyclist/wallet" });
  const queryClient = useQueryClient();
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [earningsPeriod, setEarningsPeriod] = useState<EarningsPeriod>("today");
  const [session] = useState<CyclistSession | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(CYCLIST_SESSION_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as CyclistSession;
    } catch {
      return null;
    }
  });

  const fetchWalletSummary = useServerFn(getCyclistWalletSummary);
  const fetchEarningsHistory = useServerFn(getCyclistEarningsHistory);

  const walletQuery = useQuery({
    queryKey: ["cyclist", "wallet", session?.cyclistId ?? null],
    enabled: Boolean(session?.cyclistId),
    queryFn: () => fetchWalletSummary({ data: { cyclistId: session!.cyclistId } }),
    refetchInterval: 4_000,
  });

  const earningsHistoryQuery = useQuery({
    queryKey: ["cyclist", "wallet", "earnings-history", session?.cyclistId ?? null, earningsPeriod],
    enabled: Boolean(session?.cyclistId),
    queryFn: () =>
      fetchEarningsHistory({
        data: {
          cyclistId: session!.cyclistId,
          period: earningsPeriod,
        },
      }),
    refetchInterval: 4_000,
  });

  useEffect(() => {
    if (!session?.cyclistId) return;

    const channel = supabase
      .channel(`cyclist-wallet-${session.cyclistId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `cyclist_id=eq.${session.cyclistId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["cyclist", "wallet", session.cyclistId] });
          void queryClient.invalidateQueries({ queryKey: ["cyclist", "dashboard", session.cyclistId] });
          void queryClient.invalidateQueries({ queryKey: ["cyclist", "wallet", "earnings-history", session.cyclistId] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, session?.cyclistId]);

  if (!session?.cyclistId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="space-y-3 p-5 text-center">
            <p className="text-sm text-muted-foreground">Session expired, please login again.</p>
            <Button className="w-full" onClick={() => navigate({ to: "/cyclist/login" })}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const summary = walletQuery.data;
  const earningsHistory = earningsHistoryQuery.data;

  const periodLabels: Array<{ value: EarningsPeriod; label: string }> = [
    { value: "today", label: "Today · اليوم" },
    { value: "week", label: "This Week · هذا الأسبوع" },
    { value: "month", label: "This Month · هذا الشهر" },
  ];

  const formatOrderDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("fr-MA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const qrPayload = JSON.stringify({
    type: "cash_handover",
    v: 1,
    cyclist_id: session.cyclistId,
    cash_to_remit: Number(summary?.cashToRemitMad ?? 0).toFixed(2),
    owed_by_vendor: Number(summary?.owedByVendorMad ?? 0).toFixed(2),
    net_amount: Number(summary?.netCashToHandoverMad ?? 0).toFixed(2),
    amount: Number(summary?.netCashToHandoverMad ?? 0).toFixed(2),
    issued_at: new Date().toISOString(),
  });

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-4">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <header className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/cyclist/dashboard" })}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="text-center">
            <h1 className="text-sm font-semibold">Cyclist Wallet</h1>
            <p className="text-xs text-muted-foreground">محفظة السائق</p>
          </div>
          <span className="w-9" />
        </header>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4 text-primary" />
              My Earnings · أرباح التوصيل
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{(summary?.myEarningsMad ?? 0).toFixed(2)} MAD</p>
            <p className="text-xs text-muted-foreground">Delivered today: {summary?.deliveredTodayCount ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HandCoins className="size-4 text-primary" />
              Owed by Vendor · مستحقاتي على البائع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{(summary?.owedByVendorMad ?? 0).toFixed(2)} MAD</p>
            <p className="text-xs text-muted-foreground">
              Pending carnet delivery fees: {summary?.pendingCarnetSettlementOrdersCount ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HandCoins className="size-4 text-primary" />
              Cash to Remit · الروسيطة للبائع
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-semibold">{(summary?.cashToRemitMad ?? 0).toFixed(2)} MAD</p>
            <p className="text-xs text-muted-foreground">
              Pending cash orders: {summary?.pendingCashSettlementOrdersCount ?? 0}
            </p>
            <Button
              className="w-full"
              onClick={() => {
                if ((summary?.pendingSettlementOrdersCount ?? 0) <= 0) {
                  toast.info("No pending cash to hand over. · ما كايناش فلوس معلقة دابا");
                  return;
                }
                setIsQrOpen(true);
              }}
            >
              Handover Cash · تسليم النقود
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4 text-primary" />
              Earnings History · سجل الأرباح
            </CardTitle>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {periodLabels.map((period) => (
                <Button
                  key={period.value}
                  type="button"
                  size="sm"
                  variant={earningsPeriod === period.value ? "default" : "outline"}
                  onClick={() => setEarningsPeriod(period.value)}
                >
                  {period.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Total Delivery Fees · مجموع رسوم التوصيل</p>
              <p className="text-2xl font-semibold">{(earningsHistory?.totalEarningsMad ?? 0).toFixed(2)} MAD</p>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-2">
              <p className="text-xs text-muted-foreground">Completed Deliveries · الطلبات المكتملة</p>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {(earningsHistory?.deliveries?.length ?? 0) === 0 ? (
                  <p className="py-3 text-center text-xs text-muted-foreground">
                    No deliveries for this period. · لا توجد عمليات توصيل في هذه الفترة.
                  </p>
                ) : (
                  earningsHistory!.deliveries.map((delivery) => (
                    <div key={delivery.orderId} className="rounded-md border border-border bg-background px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">Order #{delivery.orderId.slice(0, 8)}</p>
                          <p className="text-[11px] text-muted-foreground">{formatOrderDateTime(delivery.deliveredAt)}</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-primary">+ {delivery.deliveryFeeMad.toFixed(2)} MAD</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Cash Handover QR · رمز تسليم النقود</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-center">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Net Cash to Handover · الصافي لتسليمه</p>
              <p className="text-xl font-semibold">{(summary?.netCashToHandoverMad ?? 0).toFixed(2)} MAD</p>
              <p className="text-[11px] text-muted-foreground">
                Cash to remit - Owed by vendor (carnet delivery fees).
              </p>
            </div>
            <div className="mx-auto w-fit rounded-xl border border-border bg-white p-3">
              <QRCodeSVG value={qrPayload} size={220} level="M" includeMargin />
            </div>
            <p className="text-sm font-medium">Net Amount: {(summary?.netCashToHandoverMad ?? 0).toFixed(2)} MAD</p>
            <p className="text-xs text-muted-foreground">Show this QR to vendor for settlement confirmation.</p>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}