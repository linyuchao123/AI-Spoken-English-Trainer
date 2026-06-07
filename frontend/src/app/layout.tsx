import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Spoken English Trainer — 智能英语口语陪练",
  description: "与 AI 进行沉浸式英语对话练习，多场景模拟、实时发音评估、精准语法纠正",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
