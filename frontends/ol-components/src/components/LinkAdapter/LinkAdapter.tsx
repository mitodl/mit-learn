import React from "react"
import NextLink from "next/link"
import type { LinkProps } from "next/link"
import invariant from "tiny-invariant"

type LinkAdapterExtraProps = Pick<LinkProps, "scroll" | "prefetch"> & {
  /*
   * If true, enables client-side-only routing via window.history.pushState.
   * This is ONLY available for query-param updates, e.g.,
   * `href="?resource=123"`.
   *
   * This avoids calls to the NextJS server for RSC payloads that can cause
   * performance and hydration mismatch issues for example where we are only
   * updating the URL search params for modal views within the page, such as the
   * resource drawer, and do not want to trigger calls to the server page which
   * may re-fetch API data.
   */
  shallow?: boolean
  // Note: NextJS LinkProps actually does have a `shallow` prop, but at time of
  // writing it is only supported by the Pages router, so the docs for it are
  // unhelpful.
}

type LinkAdapterProps = React.ComponentProps<"a"> & LinkAdapterExtraProps

/**
 * Default link implementation used for our smoot-design theme.
 */
const LinkAdapter = ({ shallow, href = "", ...props }: LinkAdapterProps) => {
  invariant(
    !shallow || href.startsWith("?"),
    "shallow links must start with '?'",
  )
  return (
    <NextLink
      href={href}
      {...props}
      onClick={(e) => {
        if (shallow) {
          e.preventDefault()
          window.history.pushState({}, "", href)
        } else {
          props.onClick?.(e)
        }
      }}
    />
  )
}

export { LinkAdapter }
export type { LinkAdapterProps, LinkAdapterExtraProps }
