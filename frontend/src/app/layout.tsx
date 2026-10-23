import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "CreditWise — Loan clarity", template: "%s · CreditWise" },
  description: "Calculate EMIs, compare loan offers, export repayment schedules and explore loan-approval predictions.",
};

export const viewport: Viewport = {
  themeColor: "#111214",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${instrument.variable} antialiased`}>
      <body>
        <AppShell>{children}</AppShell>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "!bg-surface-2 !border-border !text-fg !rounded-2xl",
              description: "!text-muted",
            },
          }}
        />
      </body>
    </html>
  );
}
