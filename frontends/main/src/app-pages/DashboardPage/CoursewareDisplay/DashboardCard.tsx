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
import {
  EnrollmentStatus,
  EnrollmentMode,
  DashboardResourceType,
} from "./types"
import type {
  DashboardResource,
  DashboardCourse,
  DashboardProgram,
  DashboardProgramCollection,
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
import { useCreateB2bEnrollment } from "api/mitxonline-hooks/enrollment"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { useQuery } from "@tanstack/react-query"
import { programView } from "@/common/urls"

// Type guard functions
const isDashboardCourse = (
  resource: DashboardResource,
): resource is DashboardCourse => {
  return resource.type === DashboardResourceType.Course
}

const isDashboardProgram = (
  resource: DashboardResource,
): resource is DashboardProgram => {
  return resource.type === DashboardResourceType.Program
}

const isDashboardProgramCollection = (
  resource: DashboardResource,
): resource is DashboardProgramCollection => {
  return resource.type === DashboardResourceType.ProgramCollection
}

const CardRoot = styled.div<{
  screenSize: "desktop" | "mobile"
  variant?: "default" | "stacked"
}>(({ theme, screenSize, variant = "default" }) => [
  {
    position: "relative",
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    backgroundColor: theme.custom.colors.white,
    padding: "16px",
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  // Mobile styles for default variant
  variant === "default" && {
    [theme.breakpoints.down("md")]: {
      border: "none",
      borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
      borderRadius: "0px",
      boxShadow: "none",
      flexDirection: "column",
      gap: "16px",
    },
  },
  // Stacked variant styles
  variant === "stacked" && {
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

const TitleLink = styled(Link)(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    maxWidth: "calc(100% - 16px)",
  },
}))

const TitleText = styled.div<{ clickable?: boolean }>(
  ({ theme, clickable }) => ({
    ...theme.typography.subtitle2,
    color: theme.custom.colors.darkGray2,
    cursor: clickable ? "pointer" : "default",
    [theme.breakpoints.down("md")]: {
      maxWidth: "calc(100% - 16px)",
    },
  }),
)

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
  const createEnrollment = useCreateB2bEnrollment()
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
  readableId?: string | null
  startDate?: string | null
  endDate?: string | null
  enrollmentStatus?: EnrollmentStatus | null
  href?: string | null
  className?: string
  noun: string
  resourceType?: DashboardResourceType
  b2bContractId?: number | null
  "data-testid"?: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
}

const getCoursewareTextAndIcon = ({
  endDate,
  enrollmentStatus,
  noun,
  resourceType,
}: {
  endDate?: string | null
  enrollmentStatus?: EnrollmentStatus | null
  noun: string
  resourceType?: DashboardResourceType
}) => {
  if (!enrollmentStatus || enrollmentStatus === EnrollmentStatus.NotEnrolled) {
    return { text: `Start ${noun}`, endIcon: null }
  }
  if (
    (endDate && isInPast(endDate)) ||
    enrollmentStatus === EnrollmentStatus.Completed
  ) {
    return { text: `View ${noun}`, endIcon: null }
  }
  // Programs show "View Program" when enrolled, courses show "Continue"
  if (
    resourceType === DashboardResourceType.Program &&
    enrollmentStatus === EnrollmentStatus.Enrolled
  ) {
    return { text: `View ${noun}`, endIcon: null }
  }
  return { text: "Continue", endIcon: <RiArrowRightLine /> }
}

const CoursewareButton = styled(
  ({
    coursewareId,
    readableId,
    startDate,
    endDate,
    enrollmentStatus,
    href,
    className,
    noun,
    resourceType,
    b2bContractId,
    onClick,
    ...others
  }: CoursewareButtonProps) => {
    const coursewareText = getCoursewareTextAndIcon({
      endDate,
      noun,
      enrollmentStatus,
      resourceType,
    })
    const hasStarted = startDate && isInPast(startDate)
    const hasEnrolled =
      enrollmentStatus && enrollmentStatus !== EnrollmentStatus.NotEnrolled

    const oneClickEnroll = useOneClickEnroll()

    if (resourceType === DashboardResourceType.Program) {
      return (
        <ButtonLink
          size="small"
          variant="primary"
          className={className}
          href={href ?? undefined}
          {...others}
        >
          {coursewareText.text}
        </ButtonLink>
      )
    }

    if (onClick) {
      return (
        <Button
          size="small"
          variant="primary"
          className={className}
          onClick={onClick}
          {...others}
        >
          {coursewareText.text}
        </Button>
      )
    }

    if (!hasEnrolled /* enrollment flow */) {
      // For B2B courses, use one-click enrollment
      if (b2bContractId) {
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
            {coursewareText.text}
          </Button>
        )
      }

      // For non-B2B courses, show alert
      return (
        <Button
          size="small"
          variant="primary"
          className={className}
          onClick={() =>
            alert("Non-B2B course enrollment is not yet implemented.")
          }
          {...others}
        >
          {coursewareText.text}
        </Button>
      )
    } else if (
      (hasStarted || !startDate) &&
      href /* Link to course or program */
    ) {
      return (
        <ButtonLink
          size="small"
          variant="primary"
          endIcon={coursewareText.endIcon}
          href={href}
          className={className}
          {...others}
        >
          {coursewareText.text}
        </ButtonLink>
      )
    }
    // Disabled (course not started yet)
    return (
      <Button
        size="small"
        variant="primary"
        endIcon={<RiArrowRightLine />}
        disabled
        className={className}
        {...others}
      >
        {coursewareText.text}
      </Button>
    )
  },
)({ width: "124px" })

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
  width: "100%",
  paddingRight: "32px",
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
  noun?: string
  offerUpgrade?: boolean
  contextMenuItems?: SimpleMenuItem[]
  isLoading?: boolean
  buttonHref?: string | null
  buttonClick?: React.MouseEventHandler<HTMLButtonElement>
  variant?: "default" | "stacked"
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  dashboardResource,
  showNotComplete = true,
  Component,
  className,
  noun = "Course",
  offerUpgrade = true,
  contextMenuItems = [],
  isLoading = false,
  buttonHref,
  titleAction,
  buttonClick,
  variant = "default",
}) => {
  const oneClickEnroll = useOneClickEnroll()

  // Extract all conditional logic upfront
  const isCourse = isDashboardCourse(dashboardResource)
  const isProgram = isDashboardProgram(dashboardResource)
  const isProgramCollection = isDashboardProgramCollection(dashboardResource)

  // Early return for unsupported types
  if (isProgramCollection) {
    return <div>Program collection display not yet implemented</div>
  }
  if (!isCourse && !isProgram) {
    return null
  }

  // Extract resource-specific data with proper type narrowing
  const title = dashboardResource.title
  const marketingUrl = isCourse ? dashboardResource.marketingUrl : undefined
  const enrollment = isCourse ? dashboardResource.enrollment : undefined
  const run = isCourse ? dashboardResource.run : undefined
  const coursewareId = isCourse ? dashboardResource.coursewareId : null
  const readableId = isCourse ? dashboardResource.readableId : null
  const hasValidCertificate = isCourse ? !!run?.certificate?.link : false
  const enrollmentStatus = hasValidCertificate
    ? EnrollmentStatus.Completed
    : enrollment?.status

  // Title link logic
  const coursewareUrl = run?.coursewareUrl
  const hasEnrolled =
    enrollment?.status && enrollment.status !== EnrollmentStatus.NotEnrolled

  const b2bContractId = enrollment?.b2b_contract_id ?? run?.b2bContractId

  // Title link logic - only set href for enrolled courses or B2B courses
  const titleHref = isCourse
    ? hasEnrolled || b2bContractId
      ? titleAction === "marketing"
        ? marketingUrl
        : (coursewareUrl ?? marketingUrl)
      : undefined
    : undefined // Programs don't have a title link yet

  const titleClick: React.MouseEventHandler | undefined =
    isCourse && !hasEnrolled
      ? (e) => {
          e.preventDefault()
          // B2B courses use one-click enrollment
          if (b2bContractId) {
            if (!coursewareId || !coursewareUrl) return
            oneClickEnroll.mutate({
              href: coursewareUrl,
              coursewareId: coursewareId,
            })
          } else {
            // Non-B2B courses will show a dialog in the future
            alert("Non-B2B course enrollment is not yet implemented.")
          }
        }
      : undefined

  // Build sections
  const titleSection = isLoading ? (
    <>
      <Skeleton variant="text" width="95%" height={16} />
      <Skeleton variant="text" width={120} height={16} />
      <Skeleton variant="text" width={120} height={16} />
    </>
  ) : (
    <>
      {titleHref ? (
        <TitleLink
          size="medium"
          color="black"
          href={titleHref}
          onClick={titleClick}
        >
          {title}
        </TitleLink>
      ) : titleClick ? (
        <TitleText clickable onClick={titleClick}>
          {title}
        </TitleText>
      ) : (
        <TitleText>{title}</TitleText>
      )}
      {isCourse && run?.certificate?.link ? (
        <SubtitleLink href={run.certificate.link}>
          <RiAwardLine size="16px" />
          View Certificate
        </SubtitleLink>
      ) : null}
      {isCourse &&
      enrollment?.mode !== EnrollmentMode.Verified &&
      offerUpgrade ? (
        <UpgradeBanner
          data-testid="upgrade-root"
          canUpgrade={run?.canUpgrade ?? false}
          certificateUpgradeDeadline={run?.certificateUpgradeDeadline}
          certificateUpgradePrice={run?.certificateUpgradePrice}
        />
      ) : null}
    </>
  )

  const buttonSection = isLoading ? (
    <Skeleton variant="rectangular" width={120} height={32} />
  ) : isCourse ? (
    <>
      <EnrollmentStatusIndicator
        status={enrollmentStatus}
        showNotComplete={showNotComplete}
      />
      <CoursewareButton
        data-testid="courseware-button"
        coursewareId={coursewareId}
        readableId={readableId}
        startDate={run?.startDate}
        enrollmentStatus={enrollmentStatus}
        href={buttonHref ?? run?.coursewareUrl}
        endDate={run?.endDate}
        noun={noun}
        resourceType={DashboardResourceType.Course}
        b2bContractId={b2bContractId}
        onClick={buttonClick}
      />
    </>
  ) : isProgram ? (
    <CoursewareButton
      noun="Program"
      resourceType={DashboardResourceType.Program}
      enrollmentStatus={dashboardResource.enrollment?.status}
      href={buttonHref ?? programView(dashboardResource.id)}
    />
  ) : null

  const startDateSection = isLoading ? (
    <Skeleton variant="text" width={100} height={24} />
  ) : isCourse && run?.startDate ? (
    <CourseStartCountdown startDate={run.startDate} />
  ) : null

  const menuItems = contextMenuItems.concat(
    isCourse && enrollment?.id
      ? getDefaultContextMenuItems(title, enrollment)
      : [],
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

  // Single return block with unified layout
  return (
    <>
      <CardRoot
        screenSize="desktop"
        data-testid="enrollment-card-desktop"
        as={Component}
        className={className}
        variant={variant}
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

      <CardRoot
        screenSize="mobile"
        data-testid="enrollment-card-mobile"
        as={Component}
        className={className}
        variant={variant}
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
    </>
  )
}

export {
  DashboardCard,
  CardRoot as DashboardCardRoot,
  getDefaultContextMenuItems,
}
