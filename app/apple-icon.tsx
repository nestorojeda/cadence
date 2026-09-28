import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0d0e0c",
      }}
    >
      <svg width="120" height="120" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8" stroke="#5a5c54" strokeWidth="2" />
        <circle cx="17.66" cy="6.34" r="3" fill="#d4ff3a" />
        <circle cx="6.34" cy="17.66" r="3" fill="#8c8e85" />
      </svg>
    </div>,
    size,
  );
}
