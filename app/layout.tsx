import type { Metadata, Viewport } from "next";
import { Inter, DM_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Navbar from "@/components/Navbar";
import PendoInitializer from "./PendoInitializer";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

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
  // Makes the installed PWA feel native on iOS (standalone, branded status bar + title).
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MediGuard" },
};

// Brand-yellow browser theme color (address bar / status bar on mobile).
export const viewport: Viewport = { themeColor: "#FFD84D" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(apiKey){
    (function(p,e,n,d,o){var v,w,x,y,z;o=p[d]=p[d]||{};o._q=o._q||[];
    v=['initialize','identify','updateOptions','pageLoad','track','trackAgent'];for(w=0,x=v.length;w<x;++w)(function(m){
    o[m]=o[m]||function(){o._q[m===v[0]?'unshift':'push']([m].concat([].slice.call(arguments,0)));};})(v[w]);
    y=e.createElement(n);y.async=!0;y.src='https://cdn.pendo.io/agent/static/'+apiKey+'/pendo.js';
    z=e.getElementsByTagName(n)[0];z.parentNode.insertBefore(y,z);})(window,document,'script','pendo');
})('91b5958a-52d8-4f00-8531-522dc2541d59');`,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${dmMono.variable} font-sans`}
      >
        <PendoInitializer />
        <ServiceWorkerRegister />
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
