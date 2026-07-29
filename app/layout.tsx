import type { Metadata } from "next";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const title = "GroundedCV｜可信简历实验室";
  const description = "从真实经历出发，生成与岗位相关、能够经得住面试追问的完整简历。";

  return {
    title,
    description,
    icons: { icon: "/favicon.svg" },
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
