import {
  styled,
  Breadcrumbs,
  HEADER_HEIGHT,
  HEADER_HEIGHT_MD,
} from "ol-components"

export const SkipLinksNav = styled.nav(({ theme }) => ({
  position: "absolute",
  // Reveal skip links just below the fixed site header rather than over it, so
  // they don't overlap the logo/nav. Kept above the header's z-index too, as a
  // safeguard against any boundary overlap.
  top: HEADER_HEIGHT,
  left: 0,
  zIndex: theme.zIndex.appBar + 1,
  [theme.breakpoints.down("md")]: {
    top: HEADER_HEIGHT_MD,
  },
}))

export const StyledBreadcrumbs = styled(Breadcrumbs)(() => ({
  "& > span > span": { paddingBottom: 0, paddingLeft: "4px" },
}))

export const NoVideoMessage = styled.div({
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "rgba(255,255,255,0.5)",
  fontSize: 14,
})
