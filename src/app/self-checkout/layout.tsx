import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Self Checkout | PharmaPOS",
  description: "Customer self-checkout kiosk",
};

export default function SelfCheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="kiosk-root w-full overflow-hidden bg-[#f1f5f9]">
      {children}
    </div>
  );
}
