import { styled } from "ol-components"

/**
 * Layout primitives shared by the sections of this page: a full-bleed band
 * with a centred 1276px column. The bands alternate white and light gray, and
 * the site layout paints its own gray page background, so each band sets one.
 */

export const Section = styled("section", {
  shouldForwardProp: (prop) => prop !== "shade",
})<{ shade?: "white" | "gray" }>(({ theme, shade = "white" }) => ({
  display: "flex",
  justifyContent: "center",
  width: "100%",
  padding: "64px 24px",
  backgroundColor:
    shade === "gray"
      ? theme.custom.colors.lightGray1
      : theme.custom.colors.white,
  [theme.breakpoints.down("md")]: {
    padding: "40px 16px",
  },
}))

export const SectionInner = styled.div({
  width: "100%",
  maxWidth: "1276px",
})

/** The "Title + description" heading used by most sections. */
export const SectionTitle = styled.h2(({ theme }) => ({
  ...theme.typography.h2,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.h3,
  },
}))
