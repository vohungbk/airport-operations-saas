import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { THEME_INIT_SCRIPT } from "@/lib/theme/theme-script";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // A page sets `metadata.title` to its own name; the template adds the product name.
  title: {
    default: "Airport Operations SaaS",
    template: "%s | Airport Operations",
  },
  description:
    "Multi-tenant airport operations platform for child-seat rentals across rental-car partners.",
  // A private workspace: no page of it belongs in a search engine (see also `app/robots.ts`).
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // The theme script puts the `dark` class on this element before React loads.
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
