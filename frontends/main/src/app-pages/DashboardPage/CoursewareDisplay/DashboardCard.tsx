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
import {
  EmailSettingsDialog,
  JustInTimeDialog,
  UnenrollDialog,
} from "./DashboardDialogs"
import NiceModal from "@ebay/nice-modal-react"
import { useCreateEnrollment } from "api/mitxonline-hooks/enrollment"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { useQuery } from "@tanstack/react-query"

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

const useOneClickEnroll = () => {
  const mitxOnlineUser = useQuery(mitxUserQueries.me())
  const createEnrollment = useCreateEnrollment()
  const userCountry = mitxOnlineUser.data?.legal_address?.country
  const userYearOfBirth = mitxOnlineUser.data?.user_profile?.year_of_birth
  const showJustInTimeDialog = !userCountry || !userYearOfBirth

  const mutate = ({
    href,
    coursewareId,
  }: {
    href: string
    coursewareId: string
  }) => {
    if (showJustInTimeDialog) {
      NiceModal.show(JustInTimeDialog, {
        href: href,
        readableId: coursewareId,
      })
      return
    } else {
      createEnrollment.mutate(
        { readable_id: coursewareId },
        {
          onSuccess: () => {
            window.location.assign(href)
          },
        },
      )
    }
  }
  return { mutate, isPending: createEnrollment.isPending }
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
  if (
    (endDate && isInPast(endDate)) ||
    enrollmentStatus === EnrollmentStatus.Completed
  ) {
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
    const coursewareText = getCoursewareText({
      endDate,
      courseNoun,
      enrollmentStatus,
    })
    const hasStarted = startDate && isInPast(startDate)
    const hasEnrolled =
      enrollmentStatus && enrollmentStatus !== EnrollmentStatus.NotEnrolled

    const oneClickEnroll = useOneClickEnroll()

    if (!hasEnrolled /* enrollment flow */) {
      return (
        <Button
          size="small"
          variant="primary"
          className={className}
          disabled={oneClickEnroll.isPending || !coursewareId}
          onClick={() => {
            if (!href || !coursewareId) return
            oneClickEnroll.mutate({ href, coursewareId })
          }}
          endIcon={
            oneClickEnroll.isPending ? (
              <LoadingSpinner
                color="inherit"
                loading={oneClickEnroll.isPending}
                size={16}
              />
            ) : undefined
          }
          {...others}
        >
          {coursewareText}
        </Button>
      )
    } else if (hasStarted && href /* Link to course */) {
      return (
        <ButtonLink
          size="small"
          variant="primary"
          endIcon={<RiArrowRightLine />}
          href={href}
          className={className}
          {...others}
        >
          {coursewareText}
        </ButtonLink>
      )
    }
    // Disabled
    return (
      <Button
        size="small"
        variant="primary"
        endIcon={<RiArrowRightLine />}
        disabled
        className={className}
        {...others}
      >
        {coursewareText}
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
  titleAction: "marketing" | "courseware"
  dashboardResource: DashboardResource
  showNotComplete?: boolean
  className?: string
  courseNoun?: string
  offerUpgrade?: boolean
  contextMenuItems?: SimpleMenuItem[]
  isLoading?: boolean
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
  buttonHref,
  titleAction,
}) => {
  const course = dashboardResource as DashboardCourse
  const { title, marketingUrl, enrollment, run } = course
  const oneClickEnroll = useOneClickEnroll()

  const coursewareUrl = run.coursewareUrl
  const titleHref =
    titleAction === "marketing" ? marketingUrl : (coursewareUrl ?? marketingUrl)
  const hasEnrolled =
    enrollment?.status && enrollment.status !== EnrollmentStatus.NotEnrolled
  const titleClick: React.MouseEventHandler | undefined =
    titleAction === "courseware" && coursewareUrl && !hasEnrolled
      ? (e) => {
          e.preventDefault()
          if (!course.coursewareId) return
          oneClickEnroll.mutate({
            href: coursewareUrl,
            coursewareId: course.coursewareId,
          })
        }
      : undefined

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
        href={titleHref}
        onClick={titleClick}
      >
        {title}
      </TitleLink>
      {enrollment?.status === EnrollmentStatus.Completed &&
      run.certificate?.link ? (
        <SubtitleLink href={run.certificate.link}>
          {<RiAwardLine size="16px" />}
          View Certificate
        </SubtitleLink>
      ) : null}
      {enrollment?.mode !== EnrollmentMode.Verified && offerUpgrade ? (
        <UpgradeBanner
          data-testid="upgrade-root"
          canUpgrade={run.canUpgrade ?? false}
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
        justifyContent="end"
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

export {
  DashboardCard,
  CardRoot as DashboardCardRoot,
  getDefaultContextMenuItems,
}
