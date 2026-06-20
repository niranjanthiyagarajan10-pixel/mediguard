import { ImageResponse } from "next/og";

// Favicon — generated, no .ico committed. Same brand mark, 32×32.
// Edge runtime: see app/pwa-icon/[size]/route.tsx for why (next/og's node build can't read its
// font under this project's OneDrive path with spaces; the edge build embeds it).
export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 22,
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
