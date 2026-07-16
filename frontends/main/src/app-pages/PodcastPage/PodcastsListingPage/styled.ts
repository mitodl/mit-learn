import { Typography, styled } from "ol-components"
import { Button } from "@mitodl/smoot-design"

/* ── Shared layout used across all podcast pages ── */

/**
 * Full-width page background. The `variant` controls the backdrop:
 * - `responsive` (default): white on desktop, light gray on mobile (listing)
 * - `white`: always white (podcast detail)
 * - `gray`: light gray, full viewport height (episode detail)
 */
export const PageSection = styled("div", {
  shouldForwardProp: (prop) => prop !== "variant",
})<{ variant?: "responsive" | "white" | "gray" }>(
  ({ theme, variant = "responsive" }) => ({
    ...(variant === "responsive" && {
      backgroundColor: theme.custom.colors.white,
      [theme.breakpoints.down("sm")]: {
        backgroundColor: theme.custom.colors.lightGray1,
      },
    }),
    ...(variant === "white" && {
      backgroundColor: theme.custom.colors.white,
    }),
    ...(variant === "gray" && {
      backgroundColor: theme.custom.colors.lightGray1,
      minHeight: "100vh",
    }),
  }),
)

export const BreadcrumbBar = styled.div(({ theme }) => ({
  padding: "18px 0 2px 0",
  borderBottom: `1px solid ${theme.custom.colors.red}`,
  [theme.breakpoints.down("sm")]: {
    padding: "12px 0 0px 0",
  },
}))

/** Single-column grid list used to render `EpisodeItem` rows. */
export const EpisodeList = styled.div({
  display: "grid",
  gridTemplateColumns: "1fr",
})

/**
 * Primary "play" button shared across podcast pages: standard padding and
 * full-width on mobile. Pages extend it (`styled(PlayButton)(...)`) for tweaks.
 */
export const PlayButton = styled(Button)(({ theme }) => ({
  padding: "12px 24px 12px 20px",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

export const SectionDivider = styled.div(({ theme }) => ({
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
}))

export const Section = styled.div(({ theme }) => ({
  paddingTop: "80px",
  [theme.breakpoints.down("sm")]: {
    paddingTop: "64px",
  },
}))

export const SectionHeader = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: `2px solid ${theme.custom.colors.silverGray}`,
  paddingBottom: "21px",
  [theme.breakpoints.down("sm")]: {
    paddingBottom: "22px",
  },
}))

export const SectionTitle = styled("h2")(({ theme }) => ({
  color: theme.custom.colors.black,
  ...theme.typography.body1,
  lineHeight: "24px",
  margin: 0,
}))

export const SectionLink = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.red,
  lineHeight: "24px",
  textDecorationLine: "underline",
  textDecorationStyle: "solid",
  textDecorationSkipInk: "none",
  textDecorationThickness: "auto",
  textUnderlineOffset: "auto",
  textUnderlinePosition: "from-font",
}))

/**
 * Shown in place of a section's body when it is empty or has failed to load, so
 * the section header never sits over a blank space.
 */
export const SectionMessage = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  padding: "40px 0",
  [theme.breakpoints.down("sm")]: {
    padding: "32px 0",
  },
}))
