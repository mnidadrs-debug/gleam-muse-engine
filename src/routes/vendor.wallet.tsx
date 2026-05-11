import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, QrCode, Trophy, Wallet } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  getVendorDashboardData,
  getVendorSettlementSummary,
  settleCyclistCashHandover,
} from "@/lib/orders.functions";

const qrPayloadSchema = z.object({
  type: z.literal("cash_handover"),
  v: z.literal(1),
  cyclist_id: z.string().uuid(),
  cash_to_remit: z.union([z.number(), z.string()]).optional(),
  owed_by_vendor: z.union([z.number(), z.string()]).optional(),
  net_amount: z.union([z.number(), z.string()]).optional(),
  amount: z.union([z.number(), z.string()]),
  issued_at: z.string().optional(),
});

export const Route = createFileRoute("/vendor/wallet")({
  component: VendorWalletPage,
});

function VendorWalletPage() {
  const navigate = useNavigate({ from: "/vendor/wallet" });
  const queryClient = useQueryClient();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState<{ cyclistId: string; amount: number } | null>(null);
  const vendorPhoneNumber = useMemo(() => {
    if (typeof window === "undefined") return "";
    try {
      const raw = window.localStorage.getItem("bzaf.vendorSession");
      return raw ? ((JSON.parse(raw) as { phoneNumber?: string }).phoneNumber ?? "") : "";
    } catch {
      return "";
    }
  }, []);

  const fetchDashboard = useServerFn(getVendorDashboardData);
  const fetchSettlementSummary = useServerFn(getVendorSettlementSummary);
  const settleHandover = useServerFn(settleCyclistCashHandover);

  const dashboardQuery = useQuery({
    queryKey: ["vendor", "dashboard"],
    queryFn: () => fetchDashboard({ data: { phoneNumber: vendorPhoneNumber } }),
    refetchInterval: 4_000,
    placeholderData: (previousData) => previousData,
  });

  const vendorId = dashboardQuery.data?.vendor?.id ?? null;

  const settlementQuery = useQuery({
    queryKey: ["vendor", "wallet", vendorId, vendorPhoneNumber],
    enabled: Boolean(vendorId && vendorPhoneNumber),
    queryFn: () => fetchSettlementSummary({ data: { phoneNumber: vendorPhoneNumber } }),
    refetchInterval: 4_000,
  });

  useEffect(() => {
    if (!vendorId) return;

    const channel = supabase
      .channel(`vendor-wallet-${vendorId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `vendor_id=eq.${vendorId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["vendor", "wallet", vendorId] });
          void queryClient.invalidateQueries({ queryKey: ["vendor", "dashboard"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, vendorId]);

  const settleMutation = useMutation({
    mutationFn: async ({ cyclistId, amount }: { cyclistId: string; amount: number }) => {
      if (!vendorId) throw new Error("Vendor session missing.");
      return settleHandover({
        data: {
          phoneNumber: vendorPhoneNumber,
          cyclistId,
          expectedAmount: amount,
        },
      });
    },
    onSuccess: async (result) => {
      toast.success(`Net settlement confirmed: ${result.settledAmountMad.toFixed(2)} MAD · تمت تسوية الصافي`);
      setConfirmPayload(null);
      setIsScannerOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["vendor", "wallet", vendorId] }),
        queryClient.invalidateQueries({ queryKey: ["vendor", "dashboard"] }),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Settlement failed.");
    },
  });

  useEffect(() => {
    if (!isScannerOpen) return;

    let mounted = true;
    let scanner: any = null;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted) return;

        scanner = new Html5Qrcode("vendor-cash-qr-reader");
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText: string) => {
            try {
              const parsed = qrPayloadSchema.parse(JSON.parse(decodedText));
              const amount = Number(parsed.amount);
              if (!Number.isFinite(amount) || amount < 0) {
                if (!Number.isFinite(amount)) {
                  throw new Error("Invalid amount in QR payload.");
                }
              }

              setConfirmPayload({ cyclistId: parsed.cyclist_id, amount });
              setIsScannerOpen(false);
            } catch {
              toast.error("Invalid QR payload. · الرمز غير صالح");
            }
          },
          () => undefined,
        );
      } catch (error) {
        console.error("Vendor QR scanner failed:", error);
        toast.error("Unable to open camera scanner.");
      }
    };

    void startScanner();

    return () => {
      mounted = false;
      if (scanner) {
        void scanner
          .stop()
          .catch(() => undefined)
          .finally(() => {
            void scanner.clear().catch(() => undefined);
          });
      }
    };
  }, [isScannerOpen]);

  const summary = settlementQuery.data;

  const confirmationLabel = useMemo(() => {
    if (!confirmPayload) return "";
    return `${confirmPayload.amount.toFixed(2)} MAD`;
  }, [confirmPayload]);

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-4">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <header className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/vendor/dashboard" })}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="text-center">
            <h1 className="text-sm font-bold tracking-tight text-foreground">Cash Reconciliation</h1>
            <p className="text-xs text-muted-foreground">تسوية واستلام النقود</p>
          </div>
          <span className="w-9" />
        </header>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4 text-primary" />
              Unsettled Cash with Cyclists · نقود غير مسواة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{(summary?.unsettledCashWithCyclistsMad ?? 0).toFixed(2)} MAD</p>
            <p className="text-xs text-muted-foreground">Cyclists with pending remittance: {summary?.pendingCyclistCount ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Total Received Today · مجموع المستلم اليوم</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-semibold">{(summary?.totalReceivedTodayMad ?? 0).toFixed(2)} MAD</p>
            <Button className="w-full" onClick={() => setIsScannerOpen(true)}>
              <QrCode className="size-4" />
              Receive Cash / Scan QR · استلام النقود / مسح الرمز
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4 text-primary" />
              Lifetime Earnings · إجمالي الأرباح منذ البداية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{(summary?.lifetimeEarningsMad ?? 0).toFixed(2)} MAD</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Scan Cyclist Handover QR · مسح رمز السائق</DialogTitle>
          </DialogHeader>
          <div id="vendor-cash-qr-reader" className="overflow-hidden rounded-xl border border-border" />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(confirmPayload)} onOpenChange={(open) => (!open ? setConfirmPayload(null) : undefined)}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Cash Reception · تأكيد استلام النقود</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Net cash handover: {confirmationLabel}. Confirm settlement for all pending cash and carnet orders from this
            cyclist? · الصافي للتسليم: {confirmationLabel}. واش كتأكد تسوية جميع الطلبات المعلقة كاش وكارني لهاد السائق؟
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPayload(null)} disabled={settleMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!confirmPayload) return;
                settleMutation.mutate(confirmPayload);
              }}
              disabled={!confirmPayload || settleMutation.isPending}
            >
              {settleMutation.isPending ? "Confirming..." : "Confirm · تأكيد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}