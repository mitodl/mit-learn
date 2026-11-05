import { styled } from "ol-components"

/**
 * Layout primitives shared by the sections of this page: a full-bleed band
 * with a centred 1276px column. Section-specific spacing stays in each file.
 */

export const Section = styled.section(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  width: "100%",
  padding: "0 24px",
  // The site layout paints a gray page background; the design's bands are white.
  backgroundColor: theme.custom.colors.white,
}))

export const SectionInner = styled.div({
  width: "100%",
  maxWidth: "1276px",
})
