import { forwardRef } from "react";

export type ThermalReceiptOrderItem = {
  name: string;
  quantity: number;
  unitPriceMad: number;
};

export type ThermalReceiptOrder = {
  id: string;
  customerName: string;
  customerPhone: string;
  createdAt: string;
  items: ThermalReceiptOrderItem[];
  deliveryFeeMad: number;
  totalMad: number;
};

export type ThermalInvoiceSettings = {
  storeName: string;
  address: string;
  phone: string;
  taxId?: string | null;
  footerMessage: string;
};

type ThermalReceiptProps = {
  order: ThermalReceiptOrder;
  settings: ThermalInvoiceSettings;
};

export const ThermalReceipt = forwardRef<HTMLDivElement, ThermalReceiptProps>(function ThermalReceipt(
  { order, settings },
  ref,
) {
  const createdAt = new Date(order.createdAt);
  const dateText = Number.isNaN(createdAt.getTime())
    ? "-"
    : new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Casablanca",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(createdAt);
  const timeText = Number.isNaN(createdAt.getTime())
    ? "-"
    : new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Casablanca",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(createdAt);
  const itemsSubtotalMad = order.items.reduce((sum, item) => sum + item.quantity * item.unitPriceMad, 0);

  return (
    <div
      id="receipt-container"
      ref={ref}
      className="w-[80mm] bg-white text-black print:text-black"
      style={{
        maxWidth: "80mm",
        margin: 0,
        padding: "2mm",
        color: "#000",
        background: "#fff",
        fontFamily: '"Courier New", "Liberation Mono", monospace',
        fontSize: "11px",
        lineHeight: 1.35,
        direction: "ltr",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "2mm" }}>
        <div style={{ fontWeight: 700, fontSize: "13px" }}>{settings.storeName}</div>
        <div>{settings.address}</div>
        <div>{settings.phone}</div>
        {settings.taxId ? <div>Tax/ICE: {settings.taxId}</div> : null}
      </div>

      <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "1.5mm 0", marginBottom: "2mm" }}>
        <div>Order: #{order.id.slice(0, 8).toUpperCase()}</div>
        <div>
          Date: {dateText} {timeText}
        </div>
        <div>Customer: {order.customerName}</div>
        <div>Phone: {order.customerPhone}</div>
      </div>

      <div style={{ marginBottom: "2mm" }}>
        {order.items.map((item, index) => (
          <div
            key={`${order.id}-${index}-${item.name}`}
            style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "2mm", marginBottom: "1mm" }}
          >
            <div style={{ wordBreak: "break-word" }}>
              {item.quantity} x {item.name}
            </div>
            <div style={{ whiteSpace: "nowrap" }}>{(item.quantity * item.unitPriceMad).toFixed(2)} MAD</div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px dashed #000", paddingTop: "1.5mm", textAlign: "right", marginBottom: "2mm" }}>
        <div>Subtotal: {itemsSubtotalMad.toFixed(2)} MAD</div>
        <div>Delivery: {Number(order.deliveryFeeMad ?? 0).toFixed(2)} MAD</div>
        <div style={{ fontSize: "13px", fontWeight: 700 }}>TOTAL: {order.totalMad.toFixed(2)} MAD</div>
      </div>

      <div style={{ textAlign: "center" }}>{settings.footerMessage}</div>
    </div>
  );
});

ThermalReceipt.displayName = "ThermalReceipt";
