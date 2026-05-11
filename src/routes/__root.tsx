import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { I18nextProvider } from "react-i18next";

import i18n, { LANGUAGE_STORAGE_KEY } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ensureAuthSessionHydrated,
  evaluateOperationalAccess,
  subscribeToAuthChanges,
} from "@/lib/operational-auth";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover",
      },
      { title: "Lovable App" },
      { name: "description", content: "Morocco Wheels Delivery is a mobile-first web app for eco-friendly grocery delivery." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "Morocco Wheels Delivery is a mobile-first web app for eco-friendly grocery delivery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Lovable App" },
      { name: "twitter:description", content: "Morocco Wheels Delivery is a mobile-first web app for eco-friendly grocery delivery." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b0aa679a-5a7d-45be-96be-4133106ca193/id-preview-a42e8497--d3fabfd6-6e10-4019-b625-dad909d25879.lovable.app-1778348262460.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b0aa679a-5a7d-45be-96be-4133106ca193/id-preview-a42e8497--d3fabfd6-6e10-4019-b625-dad909d25879.lovable.app-1778348262460.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    const applyLanguageDirection = (language: string) => {
      const nextLang = language === "ar" ? "ar" : language === "fr" ? "fr" : "en";
      document.documentElement.lang = nextLang;
      document.documentElement.dir = nextLang === "ar" ? "rtl" : "ltr";
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLang);
    };

    applyLanguageDirection(i18n.resolvedLanguage || i18n.language);
    i18n.on("languageChanged", applyLanguageDirection);

    return () => {
      i18n.off("languageChanged", applyLanguageDirection);
    };
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <OperationalRouteGuard>
          <Outlet />
        </OperationalRouteGuard>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

function OperationalRouteGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const verifyAccess = async () => {
      setIsChecking(true);
      await ensureAuthSessionHydrated();
      if (!active) return;

      const result = evaluateOperationalAccess(location.pathname);
      if (!result.allowed && result.redirectTo) {
        await navigate({ to: result.redirectTo, replace: true });
      }

      if (active) {
        setIsChecking(false);
      }
    };

    void verifyAccess();

    return () => {
      active = false;
    };
  }, [location.pathname, navigate]);

  useEffect(() => {
    const subscription = subscribeToAuthChanges(() => {
      const result = evaluateOperationalAccess(location.pathname);
      if (!result.allowed && result.redirectTo) {
        void navigate({ to: result.redirectTo, replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [location.pathname, navigate]);

  const isOperationalPath =
    location.pathname === "/admin" ||
    location.pathname.startsWith("/admin/") ||
    location.pathname.startsWith("/vendor") ||
    location.pathname.startsWith("/cyclist");

  if (isOperationalPath && isChecking) {
    return (
      <main className="min-h-screen bg-muted/20 px-4 py-6">
        <div className="mx-auto w-full max-w-6xl space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
