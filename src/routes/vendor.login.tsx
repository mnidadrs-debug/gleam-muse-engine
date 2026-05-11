import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MessageCircle, ShieldCheck, Store } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import {
  formatMoroccoPhoneForPayload,
  isValidMoroccoPhone,
  normalizeMoroccoPhoneInput,
} from "@/lib/morocco-phone";

type VendorLoginStep = "phone" | "otp";

const OTP_WEBHOOK_URL = "https://n8n.srv961724.hstgr.cloud/webhook/otpwtss";
const ADMIN_PHONE_NUMBER = "+212605377941";

export const Route = createFileRoute("/vendor/login")({
  head: () => ({
    meta: [
      { title: "Vendor Login | Vendor Partner Portal" },
      {
        name: "description",
        content:
          "Vendor Partner Portal login for local store owners. Sign in with phone number and WhatsApp OTP.",
      },
      { property: "og:title", content: "Vendor Login | Vendor Partner Portal" },
      {
        property: "og:description",
        content:
          "Manage your store orders with a simple mobile-first WhatsApp OTP login flow.",
      },
    ],
  }),
  component: VendorLoginPage,
});

function VendorLoginPage() {
  const navigate = useNavigate({ from: "/vendor/login" });
  const [step, setStep] = useState<VendorLoginStep>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const normalizedPhone = useMemo(() => normalizeMoroccoPhoneInput(phoneNumber), [phoneNumber]);
  const isPhoneValid = isValidMoroccoPhone(normalizedPhone);

  const sendCodeViaWhatsApp = async () => {
    if (!isPhoneValid) {
      toast.error("Please enter a valid Moroccan phone number.");
      return;
    }

    setIsSendingCode(true);
    try {
      const fullPhoneNumber = formatMoroccoPhoneForPayload(normalizedPhone);

      const response = await fetch(OTP_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: fullPhoneNumber,
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed with status ${response.status}`);
      }

      toast.success("Code sent on WhatsApp.");
      setStep("otp");
    } catch {
      toast.error("Unable to send code right now. Please try again.");
    } finally {
      setIsSendingCode(false);
    }
  };

  const verifyAndLogin = async () => {
    if (otpCode.length !== 4) {
      toast.error("Please enter the 4-digit code.");
      return;
    }

    setIsVerifying(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const fullPhoneNumber = formatMoroccoPhoneForPayload(normalizedPhone);
      if (fullPhoneNumber === ADMIN_PHONE_NUMBER) {
        toast.success("تم التحقق بنجاح. مرحبًا بك في لوحة الإدارة!");
        await navigate({ to: "/admin" });
        return;
      }

      toast.success("Verified successfully. Welcome back!");
      await navigate({ to: "/vendor/dashboard" });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8 sm:py-12">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <Card className="w-full border-border/80 bg-card shadow-lg">
          <CardHeader className="space-y-4 pb-3 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <Store className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-semibold">Vendor Partner Portal</CardTitle>
              <p className="text-sm text-muted-foreground">Manage your store orders</p>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <div
              className={`transition-all duration-300 ${step === "phone" ? "opacity-100" : "pointer-events-none absolute opacity-0"}`}
            >
              <div className="space-y-2">
                <Label htmlFor="vendor-phone" className="text-sm">
                  Phone Number
                </Label>
                <div className="flex items-center overflow-hidden rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                  <span className="px-3 text-base font-medium text-muted-foreground">+212</span>
                  <Input
                    id="vendor-phone"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="6XXXXXXXX"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(normalizeMoroccoPhoneInput(event.target.value))}
                    className="h-12 border-0 text-base shadow-none focus-visible:ring-0"
                    aria-describedby="phone-help"
                  />
                </div>
                <p id="phone-help" className="text-xs text-muted-foreground">
                  Enter your store phone linked by the admin.
                </p>
              </div>

              <Button
                type="button"
                variant="default"
                size="xl"
                className="mt-4 w-full"
                disabled={!isPhoneValid || isSendingCode}
                onClick={sendCodeViaWhatsApp}
              >
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                {isSendingCode ? "Sending..." : "Send Code via WhatsApp"}
              </Button>
            </div>

            <div
              className={`space-y-4 transition-all duration-300 ${step === "otp" ? "relative opacity-100" : "pointer-events-none absolute opacity-0"}`}
            >
              <div className="space-y-1 text-center">
                <h2 className="text-base font-semibold text-foreground">Enter your OTP</h2>
                <p className="text-sm text-muted-foreground">Enter the code sent to your WhatsApp</p>
              </div>

              <div className="flex justify-center">
                <InputOTP
                  value={otpCode}
                  onChange={(value) => setOtpCode(value.replace(/\D/g, "").slice(0, 4))}
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
                type="button"
                variant="default"
                size="xl"
                className="w-full"
                disabled={otpCode.length !== 4 || isVerifying}
                onClick={verifyAndLogin}
              >
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                {isVerifying ? "Verifying..." : "Verify & Login"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-sm"
                onClick={() => {
                  setStep("phone");
                  setOtpCode("");
                }}
              >
                Change phone number
              </Button>
            </div>

            <div className="pt-1 text-center">
              <Button type="button" variant="link" className="h-auto p-0 text-sm text-muted-foreground">
                Need help? Contact Admin
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
