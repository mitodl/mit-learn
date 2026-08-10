import React from "react"
import NextLink from "next/link"
import type { LinkProps } from "next/link"
import invariant from "tiny-invariant"

const isSamePage = (url: string) => url.startsWith("?") || url.startsWith("#")

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
   * Must be same-page — starting with `?` or `#`. A push does not re-render
   * the route, so a URL naming a different page would only make the address
   * bar disagree with what is on screen. Anything else is a development-time
   * error and falls back to navigating `href`.
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
        const url = typeof pushUrl === "function" ? pushUrl() : pushUrl
        if (!isSamePage(url)) {
          /**
           * Next patches `pushState` to dispatch ACTION_RESTORE carrying the
           * *current* entry's router tree, so an external push swaps the
           * canonical URL without re-rendering the route. Same-page is the only
           * URL for which that is the intent; anything else would leave the
           * address bar describing a page that is not the one mounted.
           *
           * Falling through rather than throwing keeps a released build on the
           * correct page: `href` is a real URL, so the click becomes a full
           * navigation instead of a dead link.
           */
          invariant(
            process.env.NODE_ENV === "production",
            `pushUrl must be same-page, starting with "?" or "#". Got "${url}".`,
          )
          return
        }
        e.preventDefault()
        window.history.pushState({}, "", url)
      }}
    />
  )
}

export { LinkAdapter }
export type { LinkAdapterProps, LinkAdapterExtraProps, PushUrl }
