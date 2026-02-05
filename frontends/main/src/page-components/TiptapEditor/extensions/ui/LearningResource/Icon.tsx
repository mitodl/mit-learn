import React from "react"

export const Icon: React.FC<React.SVGProps<SVGSVGElement>> = ({
  className,
  ...props
}) => (
  <svg
    viewBox="0 0 24 24"
    width="34"
    height="34"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className ?? "tiptap-button-icon"}
    aria-hidden="true"
    {...props}
  >
    <title>Insert course</title>

    {/* Rounded Book */}
    <rect x="4" y="3" width="16" height="18" rx="3" ry="3" />

    {/* Content lines */}
    <line x1="8" y1="8" x2="14" y2="8" />
    <line x1="8" y1="11" x2="12" y2="11" />
  </svg>
)
