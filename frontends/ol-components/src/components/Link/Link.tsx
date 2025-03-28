import React from "react"
import styled from "@emotion/styled"
import { css } from "@emotion/react"
import { theme } from "../ThemeProvider/ThemeProvider"
import { LinkAdapter } from "../LinkAdapter/LinkAdapter"

type LinkStyleProps = {
  color: "black" | "white" | "red"
  size?: "small" | "medium" | "large"
  hovercolor?: "black" | "white" | "red"
  nohover?: boolean
}

const DEFAULT_PROPS: Required<Omit<LinkStyleProps, "color">> = {
  size: "medium",
  hovercolor: "red",
  nohover: false,
}

const NO_FORWARD = Object.keys({
  size: false,
  color: false,
  hovercolor: false,
  nohover: false,
} satisfies Record<keyof LinkStyleProps, boolean>)
/**
 * Generate styles used for the Link component.
 *
 * If you need a Link, use Link directly.
 * If you want another element styled as a Link, use this function in conjunction
 * with `styled`. For example, `styled.span(linkStyles)`.
 */
const linkStyles = (props: LinkStyleProps) => {
  const { size, color, hovercolor, nohover } = { ...DEFAULT_PROPS, ...props }

  return css([
    {
      small:
        color === "black"
          ? { ...theme.typography.subtitle3 }
          : { ...theme.typography.body3 },
      medium:
        color === "black"
          ? { ...theme.typography.subtitle2 }
          : { ...theme.typography.body2 },
      large:
        color === "black"
          ? { ...theme.typography.subtitle1 }
          : { ...theme.typography.body1 },
    }[size],
    {
      color: {
        ["black"]: theme.custom.colors.darkGray2,
        ["white"]: theme.custom.colors.white,
        ["red"]: theme.custom.colors.red,
      }[color],
      ":hover": nohover
        ? undefined
        : {
            color: {
              ["black"]: theme.custom.colors.darkGray2,
              ["white"]: theme.custom.colors.white,
              ["red"]: theme.custom.colors.lightRed,
            }[hovercolor],
            textDecoration: "underline",
          },
    },
  ])
}

type LinkProps = LinkStyleProps &
  React.ComponentProps<"a"> & {
    /* Pass shallow to navigate with window.history.pushState
     * on the client only to prevent calls to the Next.js server
     * for RSC payloads - these cause performance and hydration mismatch
     * issues for example where we are only updating the URL search params
     * for modal views within the page, such as the resource drawer, and
     * do not want to trigger calls to the server page which may
     * re-fetch API data.
     */
    shallow?: boolean
    scroll?: boolean
    prefetch?: boolean
  }

/**
 * A styled link. By default, renders a medium-sized black link using the Link
 * component from `next/link`. This is appropriate for in-app routing.
 *
 * If you need to force a full-page reload, e.g., for login/logout links, use
 * set `nativeAnchor={true}`.
 *
 * For a link styled as a button, use ButtonLink.
 */
const Link = styled(LinkAdapter, {
  shouldForwardProp: (propName) => !NO_FORWARD.includes(propName),
})<LinkStyleProps>(linkStyles)

export { Link, linkStyles }
export type { LinkProps }
