import React from "react"
import NextLink from "next/link"
import type { LinkProps } from "next/link"

/**
 * A URL for {@link LinkAdapterExtraProps.pushUrl}, or a function returning one.
 *
 * The function form is called at click time, so it can read state that is only
 * knowable then — the current URL, say — without the component subscribing to
 * it and re-rendering.
 */
type PushUrl = string | (() => string)

type LinkAdapterExtraProps = Pick<LinkProps, "scroll" | "prefetch"> & {
  /**
   * If set, a plain click pushes this URL with `window.history.pushState`
   * rather than navigating to `href`.
   *
   * Use it where the link should *point* at a real, shareable, crawlable URL
   * but a click should update the current page instead of leaving it — the
   * resource drawer, whose href is the canonical `/search?resource=…` while a
   * click keeps you on the page you were browsing.
   *
   * `pushUrl === href` is the "shallow routing" case: a query-param update
   * that must not hit the Next server for an RSC payload, which would cause
   * refetches and hydration mismatches for modal views like the drawer.
   *
   * Modified clicks (⌘, Ctrl, Shift, Alt), clicks a caller's own onClick has
   * already prevented, and links with a `target` are left alone, so they get
   * ordinary anchor behaviour on `href`. Middle-click and the context menu
   * never reach React's onClick at all.
   *
   * Setting this also disables prefetching, since a plain click never
   * navigates to `href`. Pass `prefetch` explicitly to opt back in.
   */
  pushUrl?: PushUrl
}

type LinkAdapterProps = React.ComponentProps<"a"> & LinkAdapterExtraProps

/**
 * Default link implementation used for our smoot-design theme.
 */
const LinkAdapter = ({ pushUrl, href = "", ...props }: LinkAdapterProps) => {
  return (
    <NextLink
      href={href}
      prefetch={pushUrl ? false : undefined}
      {...props}
      onClick={(e) => {
        props.onClick?.(e)
        if (!pushUrl) return
        if (e.defaultPrevented) return
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        if (e.currentTarget.target && e.currentTarget.target !== "_self") return
        e.preventDefault()
        window.history.pushState(
          {},
          "",
          typeof pushUrl === "function" ? pushUrl() : pushUrl,
        )
      }}
    />
  )
}

export { LinkAdapter }
export type { LinkAdapterProps, LinkAdapterExtraProps, PushUrl }
