import type { Metadata } from "next";
import { Inter, DM_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
});

// Novus (Pendo) analytics — required for hackathon prize eligibility.
// Renders only once NEXT_PUBLIC_NOVUS_APP_ID is set, so there's no broken
// request before Novus hands you an app ID (which needs your repo connected first).
const novusAppId = process.env.NEXT_PUBLIC_NOVUS_APP_ID;

// Apply the saved (or system) theme before first paint so there's no flash of
// the wrong mode. Runs synchronously in <head> ahead of the body.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme:dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export const metadata: Metadata = {
  title: "MediGuard — Know exactly what you're taking",
  description: "Record your doctor visit. Get a full safety audit. Never miss a dose.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${inter.variable} ${dmMono.variable} font-sans`}
      >
        <Navbar />
        {children}
        {novusAppId && (
          <Script
            src="https://cdn.novus.ai/agent.js"
            data-app-id={novusAppId}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
