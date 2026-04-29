import { ImageResponse } from "next/og";

// Next.js apple-icon convention only accepts .jpg/.jpeg/.png — SVG is
// silently ignored, which is why mobile Safari fell back to the Vercel
// default. We generate a 180×180 PNG at build time so iOS picks it up
// for tabs and "Add to Home Screen".

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #fde68a 0%, #facc15 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 28,
        }}
      >
        {/* Suitcase handle */}
        <div
          style={{
            width: 60,
            height: 22,
            border: "10px solid #0f172a",
            borderRadius: 8,
            background: "transparent",
            marginBottom: 4,
          }}
        />
        {/* Suitcase body */}
        <div
          style={{
            width: 116,
            height: 90,
            background: "#0f172a",
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {/* Center divider */}
          <div
            style={{
              position: "absolute",
              top: 6,
              bottom: 6,
              left: "50%",
              width: 4,
              marginLeft: -2,
              background: "#facc15",
              borderRadius: 2,
            }}
          />
          {/* Lock plate */}
          <div
            style={{
              width: 32,
              height: 18,
              background: "#facc15",
              borderRadius: 4,
              zIndex: 1,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
