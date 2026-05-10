import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, HandCoins, Wallet } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getCyclistWalletSummary } from "@/lib/cyclists.functions";

const CYCLIST_SESSION_STORAGE_KEY = "bzaf.cyclistSession";

type CyclistSession = {
  cyclistId: string;
  fullName: string;
  phoneNumber: string;
};

export const Route = createFileRoute("/cyclist/wallet")({
  component: CyclistWalletPage,
});

function CyclistWalletPage() {
  const navigate = useNavigate({ from: "/cyclist/wallet" });
  const queryClient = useQueryClient();
  const [isQrOpen, setIsQrOpen] = useState(false);
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

  const walletQuery = useQuery({
    queryKey: ["cyclist", "wallet", session?.cyclistId ?? null],
    enabled: Boolean(session?.cyclistId),
    queryFn: () => fetchWalletSummary({ data: { cyclistId: session!.cyclistId } }),
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
  const qrPayload = JSON.stringify({
    type: "cash_handover",
    v: 1,
    cyclist_id: session.cyclistId,
    amount: Number(summary?.cashToRemitMad ?? 0).toFixed(2),
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
              Cash to Remit · الروسيطة للبائع
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-semibold">{(summary?.cashToRemitMad ?? 0).toFixed(2)} MAD</p>
            <p className="text-xs text-muted-foreground">
              Pending settlement orders: {summary?.pendingSettlementOrdersCount ?? 0}
            </p>
            <Button
              className="w-full"
              onClick={() => {
                if ((summary?.cashToRemitMad ?? 0) <= 0) {
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
      </div>

      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Cash Handover QR · رمز تسليم النقود</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-center">
            <div className="mx-auto w-fit rounded-xl border border-border bg-white p-3">
              <QRCodeSVG value={qrPayload} size={220} level="M" includeMargin />
            </div>
            <p className="text-sm font-medium">Amount: {(summary?.cashToRemitMad ?? 0).toFixed(2)} MAD</p>
            <p className="text-xs text-muted-foreground">Show this QR to vendor for settlement confirmation.</p>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}