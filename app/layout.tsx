import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { Providers } from "@/lib/providers";
import "../styles/main.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

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
    <html lang="en" className={dmSans.variable}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
