import React from "react"

export function Avatar({
  size = 48,
  initials = "AB",
  bg = "#EEE",
  color = "#555",
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ borderRadius: "50%", background: bg }}
    >
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dy=".35em"
        fontSize={size * 0.4}
        fontWeight="600"
        fill={color}
        fontFamily="sans-serif"
      >
        {initials}
      </text>
    </svg>
  )
}

export const ShareButton = ({ size = 30, color = "#9e9e9e" }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 30 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer Circle */}
      <circle
        cx="15"
        cy="15"
        r="13.5"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
      />

      {/* Share Icon */}
      <circle cx="19" cy="11" r="2" fill={color} />
      <circle cx="11" cy="15" r="2" fill={color} />
      <circle cx="19" cy="19" r="2" fill={color} />

      <line
        x1="12.7"
        y1="14.2"
        x2="17.3"
        y2="12"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="12.7"
        y1="15.8"
        x2="17.3"
        y2="18"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default ShareButton
