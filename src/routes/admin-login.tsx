import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MessageCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { createOtpRequest, verifyOtpCode } from "@/lib/customers.functions";
import {
  ADMIN_PHONE,
  formatMoroccoPhoneForPayload,
  isValidMoroccoPhone,
  normalizeMoroccoPhoneInput,
} from "@/lib/morocco-phone";
import { useServerFn } from "@tanstack/react-start";
import { persistRoleSession } from "@/lib/operational-auth";

type AdminLoginStep = "phone" | "otp";

const OTP_WEBHOOK_URL = "https://n8n.srv961724.hstgr.cloud/webhook/otpwtss";
const AUTHORIZED_ADMIN_PHONE = ADMIN_PHONE;

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: "Super-Admin Login | Bzaf Fresh" },
      {
        name: "description",
        content: "Secure WhatsApp OTP login for super-admin access.",
      },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate({ from: "/admin-login" });
  const requestOtp = useServerFn(createOtpRequest);
  const verifyOtp = useServerFn(verifyOtpCode);

  const [step, setStep] = useState<AdminLoginStep>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [phoneForOtp, setPhoneForOtp] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const normalizedPhone = useMemo(() => normalizeMoroccoPhoneInput(phoneNumber), [phoneNumber]);
  const isPhoneValid = isValidMoroccoPhone(normalizedPhone);

  const sendCodeViaWhatsApp = async () => {
    if (!isPhoneValid) {
      toast.error("يرجى إدخال رقم هاتف مغربي صحيح.");
      return;
    }

    setIsSendingCode(true);
    try {
      const fullPhoneNumber = formatMoroccoPhoneForPayload(normalizedPhone);
      const otpPayload = await requestOtp({ data: { phoneNumber: fullPhoneNumber } });

      setPhoneForOtp(fullPhoneNumber);
      setStep("otp");
      toast.success("تم إرسال الرمز عبر واتساب.");

      fetch(OTP_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: otpPayload.phoneNumber,
          otpCode: otpPayload.otpCode,
        }),
      }).catch((error) => {
        console.error("Admin OTP webhook trigger failed:", error);
      });
    } catch (error) {
      console.error("Failed to start admin auth:", error);
      toast.error("تعذر إرسال الرمز حالياً. حاول مرة أخرى.");
    } finally {
      setIsSendingCode(false);
    }
  };

  const verifyAndLogin = async () => {
    if (otpCode.length !== 4) {
      toast.error("يرجى إدخال رمز مكوّن من 4 أرقام.");
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
        toast.error("الرمز غير صحيح.");
        return;
      }

      if (phoneForOtp === AUTHORIZED_ADMIN_PHONE) {
        persistRoleSession("admin", { phoneNumber: phoneForOtp });
        toast.success("تم التحقق بنجاح.");
        await navigate({ to: "/admin" });
        return;
      }

      toast.error("Unauthorized access. Admin privileges required.");
    } catch (error) {
      console.error("Admin OTP verification failed:", error);
      toast.error("تعذر التحقق الآن. حاول مرة أخرى.");
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
              <ShieldCheck className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-semibold">Super-Admin Login</CardTitle>
              <p className="text-sm text-muted-foreground">تسجيل دخول المشرف</p>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <div
              className={`transition-all duration-300 ${step === "phone" ? "opacity-100" : "pointer-events-none absolute opacity-0"}`}
            >
              <div className="space-y-2">
                <Label htmlFor="admin-phone" className="text-sm">
                  رقم الهاتف
                </Label>
                <div className="flex items-center overflow-hidden rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                  <span className="px-3 text-base font-medium text-muted-foreground">+212</span>
                  <Input
                    id="admin-phone"
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
                {isSendingCode ? "جاري الإرسال..." : "إرسال الرمز عبر واتساب"}
              </Button>
            </div>

            <div
              className={`space-y-4 transition-all duration-300 ${step === "otp" ? "relative opacity-100" : "pointer-events-none absolute opacity-0"}`}
            >
              <div className="space-y-1 text-center">
                <h2 className="text-base font-semibold text-foreground">أدخل رمز التحقق</h2>
                <p className="text-sm text-muted-foreground">أدخل الرمز الذي وصلك عبر واتساب</p>
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
                size="xl"
                className="w-full"
                disabled={otpCode.length !== 4 || isVerifying}
                onClick={verifyAndLogin}
              >
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                {isVerifying ? "جاري التحقق..." : "Verify & Login"}
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
                تغيير رقم الهاتف
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}