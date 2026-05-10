import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";

import { CustomerLayout } from "@/components/CustomerLayout";
import { useCustomerCartStore } from "@/lib/customer-cart-store";

export const Route = createFileRoute("/customer")({
  component: CustomerRouteLayout,
});

function CustomerRouteLayout() {
  const navigate = useNavigate({ from: "/customer" });
  const closeCart = useCustomerCartStore((state) => state.closeCart);

  return (
    <CustomerLayout
      onCheckoutClick={() => {
        closeCart();
        void navigate({ to: "/", hash: "checkout" });
      }}
    >
      <Outlet />
    </CustomerLayout>
  );
}
