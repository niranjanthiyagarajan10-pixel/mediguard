import { ImageResponse } from "next/og";

// iOS home-screen icon (apple-touch-icon). Next auto-injects the <link> from this special file.
// Same "M" on brand yellow as the PWA icons, sized to Apple's 180×180.
// Edge runtime: see app/pwa-icon/[size]/route.tsx for why (next/og's node build can't read its
// font under this project's OneDrive path with spaces; the edge build embeds it).
export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FFD84D",
          color: "#1C1C1E",
          fontSize: 112,
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        M
      </div>
    ),
    { ...size }
  );
}
