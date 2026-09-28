import { ReceiptForm } from "./receipt-form";

export const dynamic = "force-dynamic";

export default function Home() {
  const promoStart = process.env.PROMO_START_DATE ?? "";
  const promoEnd = process.env.PROMO_END_DATE ?? "";
  return <ReceiptForm promoStart={promoStart} promoEnd={promoEnd} />;
}
