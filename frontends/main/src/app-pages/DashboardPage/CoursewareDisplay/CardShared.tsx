import React from "react"
import { Link, Stack, styled, Typography } from "ol-components"
import NextLink from "next/link"
import { EnrollmentStatus } from "./helpers"
import { ActionButton, Button, ButtonLink } from "@mitodl/smoot-design"
import {
  DashboardResource,
  DashboardType,
  getEnrollmentStatus,
} from "./model/dashboardViewModel"
import { calendarDaysUntil, isInPast } from "ol-utilities"

const CardRoot = styled.div<{
  screenSize: "desktop" | "mobile"
  layout?: "default" | "compact"
}>(({ theme, screenSize, layout = "default" }) => [
  {
    position: "relative",
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    backgroundColor: theme.custom.colors.white,
    padding: "16px",
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  // Mobile styles for default layout
  layout === "default" && {
    [theme.breakpoints.down("md")]: {
      border: "none",
      borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
      borderRadius: "0px",
      boxShadow: "none",
      flexDirection: "column",
      gap: "16px",
    },
  },
  // Compact layout styles
  layout === "compact" && {
    border: "none",
    borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
    borderRadius: "0px !important",
    boxShadow: "none",
    "&:first-of-type": {
      borderTopLeftRadius: "8px !important",
      borderTopRightRadius: "8px !important",
    },
    "&:last-of-type": {
      borderBottomLeftRadius: "8px !important",
      borderBottomRightRadius: "8px !important",
      borderBottom: "none",
    },
    [theme.breakpoints.down("md")]: {
      flexDirection: "column",
      gap: "16px",
    },
  },
  screenSize === "desktop" && {
    [theme.breakpoints.down("md")]: {
      display: "none",
    },
  },
  screenSize === "mobile" && {
    [theme.breakpoints.up("md")]: {
      display: "none",
    },
  },
])

const CardTypeText = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle4,
  color: theme.custom.colors.silverGrayDark,
}))

const TitleHeading = styled.h3(({ theme }) => ({
  margin: 0,
  [theme.breakpoints.down("md")]: {
    maxWidth: "calc(100% - 16px)",
  },
}))

const TitleLink = styled(Link)()

const TitleText = styled.h3<{ clickable?: boolean }>(
  ({ theme, clickable }) => ({
    margin: 0,
    ...theme.typography.subtitle2,
    color: theme.custom.colors.darkGray2,
    cursor: clickable ? "pointer" : "default",
    [theme.breakpoints.down("md")]: {
      maxWidth: "calc(100% - 16px)",
    },
  }),
)

const SubtitleLinkRoot = styled.div<{ layout?: "default" | "compact" }>(
  ({ theme, layout = "default" }) => ({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: 1,
    color:
      layout === "compact"
        ? theme.custom.colors.silverGrayDark
        : theme.custom.colors.darkGray2,
    ...theme.typography.subtitle3,
  }),
)

const SubtitleLink = styled(NextLink)<{ layout?: "default" | "compact" }>(
  ({ theme, layout = "default" }) => ({
    ...theme.typography.subtitle3,
    color:
      layout === "compact"
        ? theme.custom.colors.silverGrayDark
        : theme.custom.colors.mitRed,
    display: "flex",
    alignItems: "center",
    gap: "4px",
    ":hover": {
      textDecoration: "underline",
    },
  }),
)

const MenuButton = styled(ActionButton)<{
  status: EnrollmentStatus
}>(({ theme, status }) => [
  {
    marginLeft: "-8px",
    [theme.breakpoints.down("md")]: {
      position: "absolute",
      top: "0",
      right: "0",
    },
  },
  status !== EnrollmentStatus.Completed &&
    status !== EnrollmentStatus.Enrolled && {
      visibility: "hidden",
    },
])

const CountdownRoot = styled.div<{ layout?: "default" | "compact" }>(
  ({ theme, layout = "default" }) => ({
    width: layout === "compact" ? "88px" : "100%",
    paddingRight: layout === "compact" ? "0px" : "32px",
    display: "flex",
    justifyContent: "center",
    alignSelf: "end",
    whiteSpace: layout === "compact" ? "nowrap" : "normal",
    [theme.breakpoints.down("md")]: {
      marginRight: "0px",
      justifyContent: "flex-start",
    },
  }),
)

const COURSEWARE_BUTTON_WIDTH = "88px"

// Thin vertical divider shown between the certificate/upgrade links and the
// courseware action button in the compact (module row) layout.
const HorizontalSeparator = styled.div(({ theme }) => ({
  width: "1px",
  height: "12px",
  backgroundColor: theme.custom.colors.lightGray2,
}))

// Fixed-width column that keeps the courseware button (and countdown) aligned
// in the compact (module row) layout.
const CoursewareActionColumn = styled(Stack)({
  width: COURSEWARE_BUTTON_WIDTH,
  flexShrink: 0,
})

// Compact-layout courseware buttons are fixed width and use the text variant.
const CoursewareButton = styled(Button)(({ theme, variant }) => ({
  width: COURSEWARE_BUTTON_WIDTH,
  minWidth: COURSEWARE_BUTTON_WIDTH,
  ...(variant === "text" && {
    color: theme.custom.colors.silverGrayDark,
  }),
}))

const CoursewareButtonLink = styled(ButtonLink)(({ theme, variant }) => ({
  width: COURSEWARE_BUTTON_WIDTH,
  minWidth: COURSEWARE_BUTTON_WIDTH,
  ...(variant === "text" && {
    color: theme.custom.colors.silverGrayDark,
  }),
}))

/**
 * Rewrites a raw mitxonline certificate link (`/certificate/{uuid}/`) to MIT
 * Learn's own certificate route (`/certificate/{certificateType}/{uuid}/`).
 */
const getCertificateLink = (
  link: string | null | undefined,
  certificateType: "course" | "program",
): string | null => {
  if (!link) return null
  const pattern = /\/certificate\/([^/]+)\/?$/
  return link.replace(pattern, `/certificate/${certificateType}/$1/`)
}

const getDashboardEnrollmentStatus = (
  resource: DashboardResource,
): EnrollmentStatus => {
  const hasValidCertificate =
    resource.type !== DashboardType.Course && !!resource.data.certificate?.uuid

  if (resource.type === DashboardType.Course) {
    return EnrollmentStatus.NotEnrolled
  }

  if (resource.type === DashboardType.CourseRunEnrollment) {
    return hasValidCertificate
      ? EnrollmentStatus.Completed
      : getEnrollmentStatus(resource.data)
  }

  return hasValidCertificate
    ? EnrollmentStatus.Completed
    : EnrollmentStatus.Enrolled
}

const Separator = styled.span(({ theme }) => ({
  display: "inline-block",
  width: "1px",
  height: "12px",
  margin: "0 8px",
  backgroundColor: theme.custom.colors.silverGrayLight,
}))

const DateText = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle3,
  color: theme.custom.colors.silverGrayDark,
}))

// Converts a calendarDaysUntil value to a human-readable relative-day suffix.
// Positive = future (Tomorrow / in N days), negative = past (Yesterday / N days ago), 0 = Today.
const formatCalendarDays = (days: number): string => {
  const abs = Math.abs(days)
  if (abs === 0) return "Today"
  if (days > 0) return days === 1 ? "Tomorrow" : `in ${days} days`
  return abs === 1 ? "Yesterday" : `${abs} days ago`
}

const CourseDateText: React.FC<{
  startDate?: string | null | undefined
  endDate?: string | null | undefined
  className?: string
}> = ({ startDate, endDate, className }) => {
  if (!startDate && !endDate) return null
  const hasStarted = startDate ? isInPast(startDate) : true
  const daysUntilStart = startDate ? calendarDaysUntil(startDate) : null
  const daysUntilEnd = endDate ? calendarDaysUntil(endDate) : null
  const hasEnded = endDate ? isInPast(endDate) : false

  if (!hasStarted) {
    if (daysUntilStart === null || daysUntilStart < 0) return null
    return (
      <DateText className={className}>
        {`Starts ${formatCalendarDays(daysUntilStart)}`}
      </DateText>
    )
  }
  if (!hasEnded) {
    if (daysUntilEnd === null || daysUntilEnd < 0) return null
    return (
      <DateText className={className}>
        {`Ends ${formatCalendarDays(daysUntilEnd)}`}
      </DateText>
    )
  }
  if (daysUntilEnd === null) return null
  return (
    <DateText className={className}>
      {`Ended ${formatCalendarDays(daysUntilEnd)}`}
    </DateText>
  )
}

export {
  CardRoot,
  CardTypeText,
  TitleHeading,
  TitleLink,
  TitleText,
  SubtitleLinkRoot,
  SubtitleLink,
  MenuButton,
  CountdownRoot,
  HorizontalSeparator,
  CoursewareActionColumn,
  CoursewareButton,
  CoursewareButtonLink,
  Separator,
  DateText,
  CourseDateText,
  getCertificateLink,
  getDashboardEnrollmentStatus,
}
