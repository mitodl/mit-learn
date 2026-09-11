"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { styled } from "ol-components"

/**
 * A top-level link in the header bar, sitting beside the "Explore MIT" menu
 * button and sharing its treatment.
 *
 * `aria-current="page"` is set regardless of the visual treatment. Idle and
 * current differ by colour alone — about 1.8:1 on the label — so the attribute
 * is what actually conveys the state to a screen reader.
 */

const StyledLink = styled(Link)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "12px",
  padding: "8px 16px",
  borderRadius: "4px",
  textDecoration: "none",
  color: theme.custom.colors.silverGrayLight,
  transition: `color ${theme.transitions.duration.short}ms`,
  ...theme.typography.subtitle2,
  svg: {
    width: "24px",
    height: "24px",
    flexShrink: 0,
    color: theme.custom.colors.silverGray,
    transition: `color ${theme.transitions.duration.short}ms`,
  },
  "&:hover, &[aria-current='page']": {
    color: theme.custom.colors.white,
    textDecoration: "none",
    svg: { color: theme.custom.colors.white },
  },
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

type HeaderNavLinkProps = {
  href: string
  label: string
  icon: React.ReactNode
  onClick?: () => void
}

const HeaderNavLink: React.FC<HeaderNavLinkProps> = ({
  href,
  label,
  icon,
  onClick,
}) => {
  const pathname = usePathname()
  const normalize = (path: string) => path.replace(/\/+$/, "") || "/"
  const isCurrent = normalize(pathname ?? "") === normalize(href)

  return (
    <StyledLink
      href={href}
      onClick={onClick}
      aria-current={isCurrent ? "page" : undefined}
    >
      {icon}
      {label}
    </StyledLink>
  )
}

export default HeaderNavLink
