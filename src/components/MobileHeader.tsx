import type { ReactNode } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

type MobileHeaderProps = {
  title: string;
  fallbackTo?: "/customer" | "/customer/categories" | "/customer/all-products" | "/customer/flash-deals";
  rightSlot?: ReactNode;
};

export function MobileHeader({ title, fallbackTo = "/customer", rightSlot }: MobileHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === "/") {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 mb-3 border-b border-border bg-background/90 backdrop-blur-md md:hidden">
      <div className="flex h-12 items-center justify-between gap-2 px-1">
        <button
          type="button"
          aria-label="Go back"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              window.history.back();
              return;
            }

            void navigate({ to: fallbackTo });
          }}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition-colors active:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </button>

        <h1 className="line-clamp-1 flex-1 text-center text-sm font-semibold text-foreground">{title}</h1>

        <div className="flex min-w-10 items-center justify-end">{rightSlot ?? <span className="h-10 w-10" />}</div>
      </div>
    </header>
  );
}