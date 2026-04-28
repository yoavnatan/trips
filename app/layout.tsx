import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import "../styles/main.css";

export const metadata: Metadata = {
  title: "Trips",
  description: "Trips app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
