import { styled } from "ol-components"

/**
 * Layout primitives shared by the sections of this page.
 *
 * Every section is a full-bleed band with a centred 1276px column, and five of
 * the seven open with the same eyebrow / heading / body trio. These are the
 * pieces that genuinely repeat; anything section-specific stays in its own
 * file. They are deliberately local to this page rather than promoted to
 * ol-components — nothing else needs them yet.
 *
 * These style semantic elements directly rather than wrapping MUI's
 * `Typography`: `styled(Typography)` drops the polymorphic `component` prop
 * from its type, so the element and its type scale end up coupled. Spreading
 * `theme.typography.*` onto the right tag keeps both correct.
 */

export const Section = styled.section({
  display: "flex",
  justifyContent: "center",
  width: "100%",
})

export const SectionInner = styled.div(({ theme }) => ({
  width: "100%",
  maxWidth: "1276px",
  padding: "96px 24px",
  [theme.breakpoints.down("md")]: {
    padding: "32px 24px",
  },
}))

export const SectionEyebrow = styled.p(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.red,
  margin: 0,
}))

export const SectionHeading = styled.h2(({ theme }) => ({
  ...theme.typography.h2,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.h3,
  },
}))

export const SectionBody = styled.p(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.silverGrayDark,
  margin: 0,
}))

export const SectionHeader = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})
