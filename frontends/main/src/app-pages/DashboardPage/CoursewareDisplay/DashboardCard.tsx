import React from "react"
import { styled, Link, SimpleMenu, SimpleMenuItem, Stack } from "ol-components"
import NextLink from "next/link"
import { EnrollmentStatus, EnrollmentMode } from "./types"
import type { DashboardCourse } from "./types"
import { ActionButton, Button, ButtonLink } from "@mitodl/smoot-design"
import {
  RiArrowRightLine,
  RiAddLine,
  RiMore2Line,
  RiAwardLine,
} from "@remixicon/react"
import { calendarDaysUntil, isInPast, NoSSR } from "ol-utilities"

import { EnrollmentStatusIndicator } from "./EnrollmentStatusIndicator"

const CardRoot = styled.div(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  backgroundColor: theme.custom.colors.white,
  padding: "16px",
  display: "flex",
  gap: "8px",
  alignItems: "center",
}))

const MenuButton = styled(ActionButton)({
  marginLeft: "-8px",
})

type CoursewareButtonProps = {
  startDate?: string | null
  endDate?: string | null
  href?: string | null
  className?: string
  courseNoun: string
  "data-testid"?: string
}
const getCoursewareText = ({ endDate, courseNoun }: CoursewareButtonProps) => {
  if (!endDate) return `Continue ${courseNoun}`
  if (isInPast(endDate)) {
    return `View ${courseNoun}`
  }
  return `Continue ${courseNoun}`
}
const CoursewareButton = styled(
  ({
    startDate,
    endDate,
    href,
    className,
    courseNoun,
    ...others
  }: CoursewareButtonProps) => {
    const children = getCoursewareText({ endDate, courseNoun })
    const hasStarted = startDate && isInPast(startDate)
    return hasStarted && href ? (
      <ButtonLink
        size="small"
        variant="primary"
        endIcon={<RiArrowRightLine />}
        href={href}
        className={className}
        {...others}
      >
        {children}
      </ButtonLink>
    ) : (
      <Button
        size="small"
        variant="primary"
        endIcon={<RiArrowRightLine />}
        disabled
        className={className}
        {...others}
      >
        {children}
      </Button>
    )
  },
)({ width: "142px" })

const formatUpgradeTime = (daysFloat: number) => {
  if (daysFloat < 0) return ""
  const days = Math.floor(daysFloat)
  if (days > 1) {
    return `${days} days remaining`
  } else if (days === 1) {
    return `${days} day remaining`
  }
  return "Less than a day remaining"
}

const SubtitleLinkRoot = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flex: 1,
  color: theme.custom.colors.darkGray2,
  ...theme.typography.subtitle3,
}))
const SubtitleLink = styled(NextLink)(({ theme }) => ({
  ...theme.typography.subtitle3,
  color: theme.custom.colors.mitRed,
  display: "flex",
  alignItems: "center",
  gap: "4px",
  ":hover": {
    textDecoration: "underline",
  },
}))

const UpgradeBanner: React.FC<
  {
    canUpgrade: boolean
    certificateUpgradeDeadline?: string | null
    certificateUpgradePrice?: string | null
  } & React.HTMLAttributes<HTMLDivElement>
> = ({
  canUpgrade,
  certificateUpgradeDeadline,
  certificateUpgradePrice,
  ...others
}) => {
  if (!canUpgrade || !certificateUpgradeDeadline || !certificateUpgradePrice) {
    return null
  }
  if (isInPast(certificateUpgradeDeadline)) return null
  const calendarDays = calendarDaysUntil(certificateUpgradeDeadline)
  if (calendarDays === null) return null
  const formattedPrice = `$${certificateUpgradePrice}`
  return (
    <SubtitleLinkRoot {...others}>
      <SubtitleLink href="#">
        <RiAddLine size="16px" />
        Add a certificate for {formattedPrice}
      </SubtitleLink>
      <NoSSR>
        {/* This uses local time. */}
        {formatUpgradeTime(calendarDays)}
      </NoSSR>
    </SubtitleLinkRoot>
  )
}

const CountdownRoot = styled.div({
  width: "142px",
  marginRight: "32px",
  display: "flex",
  justifyContent: "center",
  alignSelf: "end",
})
const CourseStartCountdown: React.FC<{
  startDate: string
  className?: string
}> = ({ startDate, className }) => {
  const calendarDays = calendarDaysUntil(startDate)

  let value
  if (calendarDays === null || calendarDays < 0) return null
  if (calendarDays === 0) {
    value = "Starts Today"
  } else if (calendarDays === 1) {
    value = "Starts Tomorrow"
  } else {
    value = `Starts in ${calendarDays} days`
  }
  return (
    <CountdownRoot>
      <Link
        color="black"
        size="small"
        className={className}
        onClick={console.log}
      >
        {value}
      </Link>
    </CountdownRoot>
  )
}

const getMenuItems = (): SimpleMenuItem[] => [
  {
    key: "placeholder1",
    label: "Placeholder 1",
    onClick: () => {},
  },
  {
    key: "placeholder2",
    label: "Placeholder 2",
    onClick: () => {},
  },
  {
    key: "placeholder3",
    label: "Placeholder 3",
    onClick: () => {},
  },
]

type DashboardCardProps = {
  Component?: React.ElementType
  dashboardResource: DashboardCourse
  showNotComplete?: boolean
  className?: string
  courseNoun?: string
  offerUpgrade?: boolean
}
const DashboardCard: React.FC<DashboardCardProps> = ({
  dashboardResource,
  showNotComplete = true,
  Component,
  className,
  courseNoun = "Course",
  offerUpgrade = true,
}) => {
  const { title, marketingUrl, enrollment, run } = dashboardResource
  return (
    <CardRoot
      as={Component}
      className={className}
      data-testid="enrollment-card"
    >
      <Stack justifyContent="start" alignItems="stretch" gap="8px" flex={1}>
        <Link size="medium" color="black" href={marketingUrl}>
          {title}
        </Link>
        {enrollment?.status === EnrollmentStatus.Completed ? (
          <SubtitleLink href="#">
            {<RiAwardLine size="16px" />}
            View Certificate
          </SubtitleLink>
        ) : null}
        {enrollment?.mode !== EnrollmentMode.Verified && offerUpgrade ? (
          <UpgradeBanner
            data-testid="upgrade-root"
            canUpgrade={run.canUpgrade}
            certificateUpgradeDeadline={run.certificateUpgradeDeadline}
            certificateUpgradePrice={run.certificateUpgradePrice}
          />
        ) : null}
      </Stack>
      <Stack gap="8px">
        <Stack direction="row" gap="8px" alignItems="center">
          <EnrollmentStatusIndicator
            status={enrollment?.status}
            showNotComplete={showNotComplete}
          />
          <CoursewareButton
            data-testid="courseware-button"
            startDate={run.startDate}
            href={run.coursewareUrl}
            endDate={run.endDate}
            courseNoun={courseNoun}
          />
          <SimpleMenu
            items={getMenuItems()}
            trigger={
              <MenuButton size="small" variant="text" aria-label="More options">
                <RiMore2Line />
              </MenuButton>
            }
          />
        </Stack>
        {run.startDate ? (
          <CourseStartCountdown startDate={run.startDate} />
        ) : null}
      </Stack>
    </CardRoot>
  )
}

export { DashboardCard }
