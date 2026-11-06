import React from "react"

/**
 * Remix Icon's `menu-add` with its plus replaced by the check from
 * `list-check-3`, for a resource already in a learning path: the pair differs
 * in shape as well as color. Remix Icon has no such icon.
 */
const MenuCheckIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="currentColor"
    {...props}
  >
    <path d="M11 18V20H3V18H11ZM21 11V13H3V11H21ZM21 4V6H3V4H21Z" />
    <path d="M20.9572 17.3571L19.543 15.9429L16.2501 19.2358L14.4572 17.4429L13.043 18.8571L16.2501 22.0642L20.9572 17.3571Z" />
  </svg>
)

export { MenuCheckIcon }
