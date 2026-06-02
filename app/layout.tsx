import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "評価入力",
  description: "CSI score input application",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
