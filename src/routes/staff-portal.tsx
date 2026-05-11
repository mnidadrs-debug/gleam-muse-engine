import { createFileRoute, Link } from "@tanstack/react-router";
import { Bike, ShieldCheck, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type StaffPortalRole = {
  title: string;
  subtitle: string;
  href: string;
  Icon: typeof ShieldCheck;
};

const roleCards: StaffPortalRole[] = [
  {
    title: "المشرفين",
    subtitle: "دخول لوحة التحكم والإدارة الداخلية",
    href: "/vendor/login",
    Icon: ShieldCheck,
  },
  {
    title: "التجار",
    subtitle: "تسجيل الدخول لإدارة الطلبات والمتجر",
    href: "/vendor/login",
    Icon: Store,
  },
  {
    title: "عامل التوصيل",
    subtitle: "دخول تطبيق التوصيل واستلام الرحلات",
    href: "/cyclist/login",
    Icon: Bike,
  },
];

export const Route = createFileRoute("/staff-portal")({
  head: () => ({
    meta: [
      { title: "بوابة الطاقم | Bzaf Fresh" },
      {
        name: "description",
        content: "بوابة داخلية مخصصة لاختيار دور فريق التشغيل قبل تسجيل الدخول.",
      },
    ],
  }),
  component: StaffPortalPage,
});

function StaffPortalPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:py-16">
      <section className="mx-auto w-full max-w-6xl">
        <div className="mb-8 text-center sm:mb-10">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">بوابة الطاقم</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">اختر نوع الحساب للمتابعة</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          {roleCards.map(({ title, subtitle, href, Icon }) => (
            <Card
              key={title}
              className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
            >
              <CardContent className="space-y-4 p-0">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <Icon className="h-7 w-7" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-foreground">{title}</h2>
                  <p className="text-sm text-muted-foreground">{subtitle}</p>
                </div>
                <Button asChild className="w-full bg-emerald-600 text-white hover:bg-emerald-700">
                  <Link to={href}>الدخول</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}