import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MarketScope - 美国市场调研情报平台",
  description: "专业的美国50州市场调研与竞争情报分析平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="antialiased">
      <body className="min-h-screen bg-[#f8f9fa] text-[#111827]">
        {children}
      </body>
    </html>
  );
}
