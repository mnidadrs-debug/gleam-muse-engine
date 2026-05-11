import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bike, MessageCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { createOtpRequest, verifyOtpCode } from "@/lib/customers.functions";
import { getCyclistByPhone } from "@/lib/cyclists.functions";
import {
  formatMoroccoPhoneForPayload,
  isValidMoroccoPhone,
  normalizeMoroccoPhoneInput,
} from "@/lib/morocco-phone";
import { persistRoleSession } from "@/lib/operational-auth";
import { useServerFn } from "@tanstack/react-start";

const OTP_WEBHOOK_URL = "https://n8n.srv961724.hstgr.cloud/webhook/otpwtss";
const CYCLIST_SESSION_STORAGE_KEY = "bzaf.cyclistSession";
const OTP_RESEND_SECONDS = 45;

type CyclistLoginStep = "phone" | "otp";

export const Route = createFileRoute("/cyclist/login")({
  head: () => ({
    meta: [
      { title: "Cyclist Login | Bzaf Fresh" },
      {
        name: "description",
        content: "Cyclist login for mobile delivery operations using WhatsApp OTP verification.",
      },
    ],
  }),
  component: CyclistLoginPage,
});

function CyclistLoginPage() {
  const navigate = useNavigate({ from: "/cyclist/login" });
  const requestOtp = useServerFn(createOtpRequest);
  const verifyOtp = useServerFn(verifyOtpCode);
  const fetchCyclistByPhone = useServerFn(getCyclistByPhone);

  const [step, setStep] = useState<CyclistLoginStep>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [phoneForOtp, setPhoneForOtp] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpResendCountdown, setOtpResendCountdown] = useState(0);
  const [otpErrorVisual, setOtpErrorVisual] = useState(false);

  const normalizedPhone = useMemo(() => normalizeMoroccoPhoneInput(phoneNumber), [phoneNumber]);
  const isPhoneValid = isValidMoroccoPhone(normalizedPhone);

  useEffect(() => {
    if (step !== "otp" || otpResendCountdown <= 0) return;

    const timer = window.setTimeout(() => {
      setOtpResendCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [step, otpResendCountdown]);

  const triggerOtpErrorVisual = () => {
    setOtpErrorVisual(true);
    window.setTimeout(() => setOtpErrorVisual(false), 320);
  };

  const sendCodeViaWhatsApp = async () => {
    const fullPhoneNumber = phoneForOtp || formatMoroccoPhoneForPayload(normalizedPhone);

    if (!phoneForOtp && !isPhoneValid) {
      toast.error("Please enter a valid Moroccan phone number.");
      return;
    }

    setIsSendingCode(true);
    try {
      await fetchCyclistByPhone({ data: { phoneNumber: fullPhoneNumber } });

      const otpPayload = await requestOtp({ data: { phoneNumber: fullPhoneNumber } });

      setPhoneForOtp(fullPhoneNumber);
      setStep("otp");
      setOtpCode("");
      setOtpErrorVisual(false);
      setOtpResendCountdown(OTP_RESEND_SECONDS);
      toast.success("Code sent on WhatsApp.");

      fetch(OTP_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: otpPayload.phoneNumber,
          otpCode: otpPayload.otpCode,
        }),
      }).catch((error) => {
        console.error("Cyclist OTP webhook trigger failed:", error);
      });
    } catch (error) {
      console.error("Failed to start cyclist auth:", error);
      toast.error("Cyclist account not found or code could not be sent.");
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
      const verified = await verifyOtp({
        data: {
          phoneNumber: phoneForOtp,
          otpCode,
        },
      });

      if (!verified.verified) {
        toast.error("Wrong code.");
        setOtpCode("");
        triggerOtpErrorVisual();
        return;
      }

      const cyclist = await fetchCyclistByPhone({ data: { phoneNumber: phoneForOtp } });
      localStorage.setItem(
        CYCLIST_SESSION_STORAGE_KEY,
        JSON.stringify({
          cyclistId: cyclist.id,
          phoneNumber: cyclist.phoneNumber,
          fullName: cyclist.fullName,
        }),
      );
      persistRoleSession("cyclist", {
        cyclistId: cyclist.id,
        phoneNumber: cyclist.phoneNumber,
        fullName: cyclist.fullName,
      });

      toast.success("Welcome back.");
      await navigate({ to: "/cyclist/dashboard" });
    } catch (error) {
      console.error("Cyclist OTP verification failed:", error);
      toast.error("Unable to verify now. Please retry.");
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
              <Bike className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-semibold">Cyclist App Login</CardTitle>
              <p className="text-sm text-muted-foreground">Sign in and start delivering</p>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <div
              className={`transition-all duration-300 ${step === "phone" ? "opacity-100" : "pointer-events-none absolute opacity-0"}`}
            >
              <div className="space-y-2">
                <Label htmlFor="cyclist-phone" className="text-sm">
                  Phone Number
                </Label>
                <div className="flex items-center overflow-hidden rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                  <span className="px-3 text-base font-medium text-muted-foreground">+212</span>
                  <Input
                    id="cyclist-phone"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="6XXXXXXXX"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(normalizeMoroccoPhoneInput(event.target.value))}
                    className="h-12 border-0 text-base shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>

              <Button
                type="button"
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
                <p className="text-sm text-muted-foreground">Use the code sent to your WhatsApp</p>
              </div>

              <div className={`flex justify-center ${otpErrorVisual ? "animate-otp-shake" : ""}`}>
                <InputOTP
                  value={otpCode}
                  onChange={(value) => setOtpCode(value.replace(/\D/g, "").slice(0, 4))}
                  maxLength={4}
                  inputMode="numeric"
                >
                  <InputOTPGroup className="gap-2">
                    <InputOTPSlot
                      index={0}
                      className={`h-12 w-12 rounded-lg border text-lg ${otpErrorVisual ? "border-destructive" : "border-input"}`}
                    />
                    <InputOTPSlot
                      index={1}
                      className={`h-12 w-12 rounded-lg border text-lg ${otpErrorVisual ? "border-destructive" : "border-input"}`}
                    />
                    <InputOTPSlot
                      index={2}
                      className={`h-12 w-12 rounded-lg border text-lg ${otpErrorVisual ? "border-destructive" : "border-input"}`}
                    />
                    <InputOTPSlot
                      index={3}
                      className={`h-12 w-12 rounded-lg border text-lg ${otpErrorVisual ? "border-destructive" : "border-input"}`}
                    />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-sm"
                disabled={otpResendCountdown > 0 || isSendingCode}
                onClick={sendCodeViaWhatsApp}
              >
                {otpResendCountdown > 0
                  ? `Resend available in ${otpResendCountdown}s`
                  : isSendingCode
                    ? "Sending..."
                    : "Resend code"}
              </Button>

              <Button
                type="button"
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
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
