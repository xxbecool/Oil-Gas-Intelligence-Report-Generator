import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oil & Gas Intelligence Report Generator",
  description:
    "Generate executive-level oil and gas intelligence reports from trusted industry sources using AI analysis.",
  keywords: ["oil", "gas", "energy", "intelligence", "report", "OPEC", "LNG", "upstream"],
  authors: [{ name: "Oil & Gas Intelligence Unit" }],
  robots: "noindex, nofollow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
