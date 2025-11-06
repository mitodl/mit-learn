"use client"

import { styled, HEADER_HEIGHT, HEADER_HEIGHT_MD } from "ol-components"

/*
 * Use in server components gives:
 * Error: Cannot access styled.div on the server. You cannot dot into a client module from a server component. You can only pass the imported name through.
 * Solution for now is to "use client", though I would expect these to be prerendered
 */

export const PageWrapper = styled.div({
  display: "flex",
  flexDirection: "column",
  height: "100vh",
  width: "100%",
  overflow: "hidden",
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
})

export const PageWrapperInner = styled.main(({ theme }) => ({
  flex: "1",
  overflow: "auto",
  minHeight: 0,
  paddingTop: HEADER_HEIGHT,
  [theme.breakpoints.down("md")]: {
    paddingTop: HEADER_HEIGHT_MD,
  },
}))
