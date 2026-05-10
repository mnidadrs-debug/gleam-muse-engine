import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/categories/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/customer/categories/$id", params: { id: params.id } });
  },
  component: () => null,
});