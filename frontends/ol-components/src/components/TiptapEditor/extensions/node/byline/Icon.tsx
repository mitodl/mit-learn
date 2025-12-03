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
