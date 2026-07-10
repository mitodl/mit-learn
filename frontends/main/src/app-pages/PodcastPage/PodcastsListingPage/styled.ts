import { Typography, styled } from "ol-components"
import PodcastContainer from "../PodcastContainer"

/* ── Shared layout used across PodcastsListingPage sections ── */

export const PageSection = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  [theme.breakpoints.down("sm")]: {
    backgroundColor: theme.custom.colors.lightGray1,
  },
}))

export const BreadcrumbBar = styled.div(({ theme }) => ({
  padding: "18px 0 2px 0",
  borderBottom: `1px solid ${theme.custom.colors.red}`,
  [theme.breakpoints.down("sm")]: {
    padding: "12px 0 0px 0",
  },
}))

export const StyledPodcastContainer = styled(PodcastContainer)(({ theme }) => ({
  maxWidth: "1320px !important",
  padding: "0px 24px !important",
  [theme.breakpoints.down("sm")]: {
    padding: "0px 16px !important",
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
