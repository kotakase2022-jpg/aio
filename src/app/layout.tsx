import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIO記事 半自動生成ツール",
  description: "OpenAIとWordPress連携でAIO記事ドラフトを作成する業務ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full bg-slate-100 font-sans">{children}</body>
    </html>
  );
}
