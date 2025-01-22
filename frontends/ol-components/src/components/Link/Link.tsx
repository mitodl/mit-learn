import React from "react"
import { styled } from "@pigment-css/react"
import { default as NextLink } from "next/link"
import { theme } from "../theme/theme"
import invariant from "tiny-invariant"

type LinkStyleProps = {
  size?: "small" | "medium" | "large" | string
  color?: "black" | "white" | "red"
  hovercolor?: "black" | "white" | "red"
  nohover?: boolean
}

// TODO pigment check defaults still work
// const DEFAULT_PROPS: Required<LinkStyleProps> = {
//   size: "medium",
//   color: "black",
//   hovercolor: "red",
//   nohover: false,
// }

/**
 * Generate styles used for the Link component.
 *
 * If you need a Link, use Link directly.
 * If you want another element styled as a Link, use this function in conjunction
 * with `styled`. For example, `styled.span(linkStyles)`.
 */
const linkStyles = () => ({
  color: ({ color }: LinkStyleProps) => {
    switch (color) {
      case "black":
        return theme.custom.colors.darkGray2
      case "white":
        return theme.custom.colors.white
      case "red":
        return theme.custom.colors.red
      default:
        return theme.custom.colors.darkGray2
    }
  },
  ":hover": {
    color: ({ hovercolor, nohover }: LinkStyleProps) => {
      if (nohover) return "inherit"
      switch (hovercolor) {
        case "black":
          return theme.custom.colors.darkGray2
        case "white":
          return theme.custom.colors.white
        case "red":
          return theme.custom.colors.red
        default:
          return theme.custom.colors.darkGray2
      }
    },
    textDecoration: ({ nohover }: LinkStyleProps) =>
      nohover ? "inherit" : "underline",
  },
  variants: [
    {
      props: { size: "small" },
      style: theme.typography.body3,
    },
    {
      props: { size: "medium" },
      style: theme.typography.body2,
    },
    {
      props: { size: "large" },
      style: theme.typography.h5,
    },
  ],
})

type LinkProps = LinkStyleProps &
  React.ComponentProps<"a"> & {
    rawAnchor?: boolean

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

const BaseLink = ({
  href,
  shallow,
  nohover,
  scroll,
  onClick,
  ...rest
}: LinkProps) => {
  if (process.env.NODE_ENV === "development") {
    invariant(
      !shallow || href?.startsWith("?"),
      "Shallow routing should only be used to update search params",
    )
  }
  return (
    <NextLink
      scroll={scroll}
      href={href || ""}
      {...rest}
      onClick={
        onClick ||
        (shallow
          ? (e) => {
              e.preventDefault()
              window.history.pushState({}, "", href)
            }
          : undefined)
      }
    />
  )
}

/**
 * A styled link. By default, renders a medium-sized black link using the Link
 * component from `react-router`. This is appropriate for in-app routing.
 *
 * If you need to force a full-page reload, e.g., for login/logout links, use
 * set `nativeAnchor={true}`.
 *
 * For a link styled as a button, use ButtonLink.
 */
const Link = styled(BaseLink)<LinkStyleProps>(linkStyles)

export { Link, linkStyles }
export type { LinkProps }
