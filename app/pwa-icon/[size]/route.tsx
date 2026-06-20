import { ImageResponse } from "next/og";

// One Route Handler that renders the app icon as a PNG — solves "the manifest needs binary PNG
// icons" with NO committed binary asset. Prerendered for the two sizes the manifest references
// (/pwa-icon/192, /pwa-icon/512). A bold dark "M" on the brand yellow.
//
// runtime = "edge" is required: next/og's NODE build reads its font/wasm via
// fs.readFileSync(fileURLToPath(import.meta.url, …)) at import time, which throws "Invalid URL"
// when the project path contains spaces (this repo lives under a OneDrive folder). The EDGE build
// embeds those assets as base64 and touches no filesystem, so it builds reliably here.
export const runtime = "edge";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }];
}

export function GET(
  _req: Request,
  { params }: { params: { size: string } }
) {
  const size = Number(params.size) || 192;
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
          fontSize: Math.round(size * 0.6),
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        M
      </div>
    ),
    { width: size, height: size }
  );
}
