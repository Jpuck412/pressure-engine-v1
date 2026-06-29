import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pressure Engine V1",
  description:
    "Small-cap gainer-to-runner pressure scanner using volume acceleration, structure, catalyst, liquidity, and support-location scoring."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
