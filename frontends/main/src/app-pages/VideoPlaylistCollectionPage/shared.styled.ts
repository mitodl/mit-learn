import { styled, Breadcrumbs } from "ol-components"

export const SkipLinksNav = styled.nav({
  position: "absolute",
  top: 0,
  left: 0,
  zIndex: 1000,
})

export const SkipLink = styled.a(({ theme }) => ({
  position: "absolute",
  left: "-9999px",
  top: "auto",
  width: 1,
  height: 1,
  overflow: "hidden",
  backgroundColor: theme.custom.colors.white,
  color: theme.custom.colors.black,
  padding: "8px 12px",
  border: `2px solid ${theme.custom.colors.red}`,
  textDecoration: "none",
  "&:focus": {
    left: "16px",
    top: "16px",
    width: "auto",
    height: "auto",
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
