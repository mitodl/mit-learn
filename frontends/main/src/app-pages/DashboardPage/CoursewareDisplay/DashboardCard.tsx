import React from "react"
import {
  styled,
  Link,
  SimpleMenu,
  SimpleMenuItem,
  Stack,
  Skeleton,
  LoadingSpinner,
} from "ol-components"
import NextLink from "next/link"
import { EnrollmentStatus, EnrollmentMode } from "./types"
import type {
  DashboardResource,
  DashboardCourse,
  DashboardCourseEnrollment,
} from "./types"
import { ActionButton, Button, ButtonLink } from "@mitodl/smoot-design"
import {
  RiArrowRightLine,
  RiAddLine,
  RiMore2Line,
  RiAwardLine,
} from "@remixicon/react"
import { calendarDaysUntil, isInPast, NoSSR } from "ol-utilities"

import { EnrollmentStatusIndicator } from "./EnrollmentStatusIndicator"
import { EmailSettingsDialog, UnenrollDialog } from "./DashboardDialogs"
import NiceModal from "@ebay/nice-modal-react"
import { useCreateEnrollment } from "api/mitxonline-hooks/enrollment"

const CardRoot = styled.div<{
  screenSize: "desktop" | "mobile"
}>(({ theme, screenSize }) => [
  {
    position: "relative",
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    backgroundColor: theme.custom.colors.white,
    padding: "16px",
    display: "flex",
    gap: "8px",
    alignItems: "center",
    [theme.breakpoints.down("md")]: {
      border: "none",
      borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
      borderRadius: "0px",
      boxShadow: "none",
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

const SpinnerContainer = styled.div({
  marginLeft: "8px",
})

const TitleLink = styled(Link)(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    maxWidth: "calc(100% - 16px)",
  },
}))

const MenuButton = styled(ActionButton)<{
  status?: EnrollmentStatus
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

const getDefaultContextMenuItems = (
  title: string,
  enrollment: DashboardCourseEnrollment,
) => {
  return [
    {
      className: "dashboard-card-menu-item",
      key: "email-settings",
      label: "Email Settings",
      onClick: () => {
        NiceModal.show(EmailSettingsDialog, { title, enrollment })
      },
    },
    {
      className: "dashboard-card-menu-item",
      key: "unenroll",
      label: "Unenroll",
      onClick: () => {
        NiceModal.show(UnenrollDialog, { title, enrollment })
      },
    },
  ]
}

type CoursewareButtonProps = {
  coursewareId?: string | null
  startDate?: string | null
  endDate?: string | null
  enrollmentStatus?: EnrollmentStatus | null
  href?: string | null
  className?: string
  courseNoun: string
  "data-testid"?: string
}
const getCoursewareText = ({
  endDate,
  enrollmentStatus,
  courseNoun,
}: {
  endDate?: string | null
  enrollmentStatus?: EnrollmentStatus | null
  courseNoun: string
}) => {
  if (!enrollmentStatus || enrollmentStatus === EnrollmentStatus.NotEnrolled) {
    return `Start ${courseNoun}`
  }
  if (!endDate) return `Continue ${courseNoun}`
  if (isInPast(endDate)) {
    return `View ${courseNoun}`
  }
  return `Continue ${courseNoun}`
}
const CoursewareButton = styled(
  ({
    coursewareId,
    startDate,
    endDate,
    enrollmentStatus,
    href,
    className,
    courseNoun,
    ...others
  }: CoursewareButtonProps) => {
    const children = getCoursewareText({
      endDate,
      courseNoun,
      enrollmentStatus,
    })
    const hasStarted = startDate && isInPast(startDate)
    const hasEnrolled =
      enrollmentStatus && enrollmentStatus !== EnrollmentStatus.NotEnrolled
    const createEnrollment = useCreateEnrollment({
      readable_id: coursewareId ?? "",
    })
    return hasStarted && href ? (
      hasEnrolled ? (
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
          className={className}
          disabled={createEnrollment.isPending || !coursewareId}
          onClick={async () => {
            await createEnrollment.mutateAsync()
          }}
          {...others}
        >
          {children}
          {createEnrollment.isPending && (
            <SpinnerContainer>
              <LoadingSpinner loading={createEnrollment.isPending} size={16} />
            </SpinnerContainer>
          )}
        </Button>
      )
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

const CountdownRoot = styled.div(({ theme }) => ({
  width: "142px",
  marginRight: "32px",
  display: "flex",
  justifyContent: "center",
  alignSelf: "end",
  [theme.breakpoints.down("md")]: {
    marginRight: "0px",
    justifyContent: "flex-start",
  },
}))
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

type DashboardCardProps = {
  Component?: React.ElementType
  dashboardResource: DashboardResource
  showNotComplete?: boolean
  className?: string
  courseNoun?: string
  offerUpgrade?: boolean
  contextMenuItems?: SimpleMenuItem[]
  isLoading?: boolean
  titleHref?: string | null
  buttonHref?: string | null
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  dashboardResource,
  showNotComplete = true,
  Component,
  className,
  courseNoun = "Course",
  offerUpgrade = true,
  contextMenuItems = [],
  isLoading = false,
  titleHref,
  buttonHref,
}) => {
  const course = dashboardResource as DashboardCourse
  const { title, marketingUrl, enrollment, run } = course
  const titleSection = isLoading ? (
    <>
      <Skeleton variant="text" width="95%" height={16} />
      <Skeleton variant="text" width={120} height={16} />
      <Skeleton variant="text" width={120} height={16} />
    </>
  ) : (
    <>
      <TitleLink
        size="medium"
        color="black"
        href={titleHref ? titleHref : marketingUrl}
      >
        {title}
      </TitleLink>
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
    </>
  )
  const buttonSection = isLoading ? (
    <Skeleton variant="rectangular" width={120} height={32} />
  ) : (
    <>
      <EnrollmentStatusIndicator
        status={enrollment?.status}
        showNotComplete={showNotComplete}
      />
      <CoursewareButton
        data-testid="courseware-button"
        coursewareId={course.coursewareId}
        startDate={run.startDate}
        enrollmentStatus={enrollment?.status}
        href={buttonHref ? buttonHref : run.coursewareUrl}
        endDate={run.endDate}
        courseNoun={courseNoun}
      />
    </>
  )
  const startDateSection = isLoading ? (
    <Skeleton variant="text" width={100} height={24} />
  ) : run.startDate ? (
    <CourseStartCountdown startDate={run.startDate} />
  ) : null
  const menuItems = contextMenuItems.concat(
    enrollment?.id ? getDefaultContextMenuItems(title, enrollment) : [],
  )
  const contextMenu = isLoading ? (
    <Skeleton variant="rectangular" width={12} height={24} />
  ) : (
    <SimpleMenu
      items={menuItems}
      trigger={
        <MenuButton
          size="small"
          variant="text"
          aria-label="More options"
          status={enrollment?.status}
          hidden={menuItems.length === 0}
        >
          <RiMore2Line />
        </MenuButton>
      }
    />
  )
  const desktopLayout = (
    <CardRoot
      screenSize="desktop"
      data-testid="enrollment-card-desktop"
      as={Component}
      className={className}
    >
      <Stack justifyContent="start" alignItems="stretch" gap="8px" flex={1}>
        {titleSection}
      </Stack>
      <Stack gap="8px">
        <Stack direction="row" gap="8px" alignItems="center">
          {buttonSection}
          {contextMenu}
        </Stack>
        {startDateSection}
      </Stack>
    </CardRoot>
  )

  const mobileLayout = (
    <CardRoot
      screenSize="mobile"
      data-testid="enrollment-card-mobile"
      as={Component}
      className={className}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="stretch"
        flex={1}
        width="100%"
      >
        <Stack direction="column" gap="8px" flex={1}>
          {titleSection}
        </Stack>
        {contextMenu}
      </Stack>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        width="100%"
      >
        {startDateSection}
        <Stack direction="row" gap="8px" alignItems="center">
          {buttonSection}
        </Stack>
      </Stack>
    </CardRoot>
  )
  return (
    <>
      {desktopLayout}
      {mobileLayout}
    </>
  )
}

export { DashboardCard, getDefaultContextMenuItems }
