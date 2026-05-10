import { create } from "zustand";

export type CustomerPanelView = "account" | "profile" | "orders" | "carnet";

type CustomerPanelState = {
  isCustomerAuthModalOpen: boolean;
  customerPanelView: CustomerPanelView;
  setIsCustomerAuthModalOpen: (open: boolean) => void;
  setCustomerPanelView: (view: CustomerPanelView) => void;
  openCustomerPanel: (view?: CustomerPanelView) => void;
};

export const useCustomerPanelStore = create<CustomerPanelState>((set) => ({
  isCustomerAuthModalOpen: false,
  customerPanelView: "account",
  setIsCustomerAuthModalOpen: (open) => set({ isCustomerAuthModalOpen: open }),
  setCustomerPanelView: (view) => set({ customerPanelView: view }),
  openCustomerPanel: (view = "account") =>
    set({
      customerPanelView: view,
      isCustomerAuthModalOpen: true,
    }),
}));