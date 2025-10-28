"use client"

import { styled, HEADER_HEIGHT, HEADER_HEIGHT_MD } from "ol-components"

/*
 * Use in server components gives:
 * Error: Cannot access styled.div on the server. You cannot dot into a client module from a server component. You can only pass the imported name through.
 * Solution for now is to "use client", though I would expect these to be prerendered
 */

export const PageWrapper = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  height: `calc(100vh - ${HEADER_HEIGHT}px)`,
  marginTop: HEADER_HEIGHT,
  [theme.breakpoints.down("md")]: {
    marginTop: HEADER_HEIGHT_MD,
    height: `calc(100vh - ${HEADER_HEIGHT_MD}px)`,
  },
}))

export const PageWrapperInner = styled.main({
  flex: "1",
})
