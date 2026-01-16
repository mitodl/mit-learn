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
import { EnrollmentStatus, getBestRun, getEnrollmentStatus } from "./helpers"
import {
  CourseWithCourseRunsSerializerV2,
  V2Program,
  V2ProgramCollection,
  CourseRunEnrollmentRequestV2,
  V2Course,
  V2UserProgramEnrollmentDetail,
} from "@mitodl/mitxonline-api-axios/v2"

const EnrollmentMode = {
  Audit: "audit",
  Verified: "verified",
} as const
type EnrollmentMode = (typeof EnrollmentMode)[keyof typeof EnrollmentMode]

type DashboardResource =
  | CourseWithCourseRunsSerializerV2
  | V2Course
  | V2Program
  | V2ProgramCollection
  | CourseRunEnrollmentRequestV2
  | V2UserProgramEnrollmentDetail

// Type guard functions
const isCourseWithRuns = (
  resource: DashboardResource,
): resource is CourseWithCourseRunsSerializerV2 => {
  return (
    "courseruns" in resource &&
    Array.isArray((resource as CourseWithCourseRunsSerializerV2).courseruns)
  )
}

const isV2Course = (resource: DashboardResource): resource is V2Course => {
  return "course_number" in resource && !("courseruns" in resource)
}

const isCourseRunEnrollment = (
  resource: DashboardResource,
): resource is CourseRunEnrollmentRequestV2 => {
  return "run" in resource && "enrollment_mode" in resource
}

const isProgram = (resource: DashboardResource): resource is V2Program => {
  return (
    "req_tree" in resource &&
    !("courseruns" in resource) &&
    !("program" in resource)
  )
}

const isProgramEnrollment = (
  resource: DashboardResource,
): resource is V2UserProgramEnrollmentDetail => {
  return "program" in resource && "enrollments" in resource
}

const isProgramCollection = (
  resource: DashboardResource,
): resource is V2ProgramCollection => {
  return (
    "programs" in resource &&
    Array.isArray((resource as V2ProgramCollection).programs)
  )
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
  enrollment: CourseRunEnrollmentRequestV2,
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
            // Only redirect if href is provided
            if (href) {
              window.location.assign(href)
            }
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
  isProgram?: boolean
  b2bContractId?: number | null
  "data-testid"?: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
}

const getCoursewareTextAndIcon = ({
  endDate,
  enrollmentStatus,
  noun,
  isProgram,
}: {
  endDate?: string | null
  enrollmentStatus?: EnrollmentStatus | null
  noun: string
  isProgram?: boolean
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
  if (isProgram && enrollmentStatus === EnrollmentStatus.Enrolled) {
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
    isProgram,
    b2bContractId,
    onClick,
    ...others
  }: CoursewareButtonProps) => {
    const coursewareText = getCoursewareTextAndIcon({
      endDate,
      noun,
      enrollmentStatus,
      isProgram,
    })
    const hasStarted = startDate && isInPast(startDate)
    const hasEnrolled =
      enrollmentStatus && enrollmentStatus !== EnrollmentStatus.NotEnrolled

    const oneClickEnroll = useOneClickEnroll()

    if (isProgram) {
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
      // Use one-click enrollment for both B2B and non-B2B
      // The hook handles just-in-time dialog for incomplete profiles
      return (
        <Button
          size="small"
          variant="primary"
          className={className}
          disabled={oneClickEnroll.isPending || !coursewareId || !readableId}
          onClick={() => {
            if (!coursewareId || !readableId || !href) return
            oneClickEnroll.mutate({ href, coursewareId: readableId })
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
  resource: DashboardResource
  enrollment?: CourseRunEnrollmentRequestV2 | null
  titleAction?: "marketing" | "courseware"
  showNotComplete?: boolean
  offerUpgrade?: boolean
  noun?: string
  contextMenuItems?: SimpleMenuItem[]
  isLoading?: boolean
  buttonHref?: string | null
  buttonClick?: React.MouseEventHandler<HTMLButtonElement>
  Component?: React.ElementType
  className?: string
  variant?: "default" | "stacked"
  contractId?: number
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  resource,
  enrollment,
  titleAction = "courseware",
  showNotComplete = true,
  offerUpgrade = true,
  noun,
  contextMenuItems = [],
  isLoading = false,
  buttonHref,
  buttonClick,
  Component,
  className,
  variant = "default",
  contractId,
}) => {
  const oneClickEnroll = useOneClickEnroll()
  const { data: user } = useQuery(mitxUserQueries.me())

  // Determine resource type
  const resourceIsCourseWithRuns = isCourseWithRuns(resource)
  const resourceIsV2Course = isV2Course(resource)
  const resourceIsCourseRunEnrollment = isCourseRunEnrollment(resource)
  const resourceIsProgram = isProgram(resource)
  const resourceIsProgramEnrollment = isProgramEnrollment(resource)
  const resourceIsProgramCollection = isProgramCollection(resource)

  const openJustInTime = (href: string, readableId: string) => {
    const userCountry = user?.legal_address?.country
    const userYearOfBirth = user?.user_profile?.year_of_birth
    const showJustInTimeDialog = !userCountry || !userYearOfBirth

    if (showJustInTimeDialog) {
      NiceModal.show(JustInTimeDialog, {
        href,
        readableId,
      })
    } else {
      // Profile is complete, directly enroll
      oneClickEnroll.mutate({
        href,
        coursewareId: readableId,
      })
    }
  }

  // Determine if this is any kind of course
  const isAnyCourse =
    resourceIsCourseWithRuns ||
    resourceIsV2Course ||
    resourceIsCourseRunEnrollment

  // Compute default noun based on resource type
  const defaultNoun = isAnyCourse
    ? "Course"
    : resourceIsProgram || resourceIsProgramEnrollment
      ? "Program"
      : "Collection"
  const displayNoun = noun ?? defaultNoun

  // Early return for unsupported types
  if (resourceIsProgramCollection) {
    return <div>Program collection display not yet implemented</div>
  }

  // Extract common data based on resource type
  let title: string,
    enrollmentData:
      | CourseRunEnrollmentRequestV2
      | V2UserProgramEnrollmentDetail
      | null
      | undefined

  if (resourceIsCourseWithRuns) {
    title = resource.title
    enrollmentData = enrollment
  } else if (resourceIsV2Course) {
    title = resource.title
    enrollmentData = enrollment
  } else if (resourceIsCourseRunEnrollment) {
    title = resource.run.course.title
    enrollmentData = resource
  } else if (resourceIsProgram) {
    title = resource.title
    enrollmentData = enrollment
  } else if (resourceIsProgramEnrollment) {
    title = resource.program.title
    enrollmentData = enrollment
  } else {
    title = "Unknown"
    enrollmentData = undefined
  }

  // Course-specific data
  const run = resourceIsCourseWithRuns
    ? getBestRun(resource, contractId)
    : resourceIsCourseRunEnrollment
      ? resource.run
      : undefined
  const hasValidCertificate = !!enrollmentData?.certificate?.uuid
  const enrollmentStatus: EnrollmentStatus = isAnyCourse
    ? hasValidCertificate
      ? EnrollmentStatus.Completed
      : enrollmentData && "run" in enrollmentData
        ? getEnrollmentStatus(enrollmentData)
        : EnrollmentStatus.NotEnrolled
    : enrollmentData && "status" in enrollmentData
      ? (enrollmentData.status as EnrollmentStatus)
      : EnrollmentStatus.NotEnrolled

  // URLs
  const marketingUrl = resourceIsCourseWithRuns
    ? resource.page?.page_url
    : resourceIsV2Course
      ? resource.page?.page_url
      : undefined
  const coursewareUrl = run?.courseware_url
  const hasEnrolled =
    isAnyCourse && enrollmentStatus !== EnrollmentStatus.NotEnrolled
  // Check enrollment's b2b_contract_id first, then run's b2b_contract, finally fall back to contractId prop
  const b2bContractId =
    enrollmentData?.b2b_contract_id ?? run?.b2b_contract ?? contractId

  // Title link logic
  const titleHref = isAnyCourse
    ? hasEnrolled
      ? titleAction === "marketing"
        ? marketingUrl
        : (coursewareUrl ?? marketingUrl)
      : b2bContractId
        ? (coursewareUrl ?? marketingUrl)
        : undefined
    : undefined

  const titleClick: React.MouseEventHandler | undefined =
    isAnyCourse && !hasEnrolled
      ? (e) => {
          e.preventDefault()
          if (b2bContractId) {
            const readableId = resourceIsCourseWithRuns
              ? resource.readable_id
              : resourceIsV2Course
                ? resource.readable_id
                : resourceIsCourseRunEnrollment
                  ? resource.run.course.readable_id
                  : undefined
            if (!readableId || !coursewareUrl) return
            oneClickEnroll.mutate({
              href: coursewareUrl,
              coursewareId: readableId,
            })
          } else {
            const readableId = resourceIsCourseWithRuns
              ? resource.readable_id
              : resourceIsV2Course
                ? resource.readable_id
                : resourceIsCourseRunEnrollment
                  ? resource.run.course.readable_id
                  : undefined
            if (!readableId || !coursewareUrl) return
            openJustInTime(coursewareUrl, readableId)
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
      {enrollmentData?.certificate?.link ? (
        <SubtitleLink href={enrollmentData.certificate.link}>
          <RiAwardLine size="16px" />
          View Certificate
        </SubtitleLink>
      ) : null}
      {isAnyCourse &&
      enrollmentData?.enrollment_mode !== EnrollmentMode.Verified &&
      offerUpgrade ? (
        <UpgradeBanner
          data-testid="upgrade-root"
          canUpgrade={run?.is_upgradable ?? false}
          certificateUpgradeDeadline={run?.upgrade_deadline}
          certificateUpgradePrice={run?.products?.[0]?.price}
        />
      ) : null}
    </>
  )

  const buttonSection = isLoading ? (
    <Skeleton variant="rectangular" width={120} height={32} />
  ) : isAnyCourse ? (
    <>
      <EnrollmentStatusIndicator
        status={enrollmentStatus}
        showNotComplete={showNotComplete}
      />
      <CoursewareButton
        data-testid="courseware-button"
        coursewareId={
          resourceIsCourseWithRuns
            ? run?.courseware_id
            : resourceIsV2Course
              ? resource.readable_id
              : resourceIsCourseRunEnrollment
                ? resource.run.courseware_id
                : undefined
        }
        readableId={
          resourceIsCourseWithRuns
            ? resource.readable_id
            : resourceIsV2Course
              ? resource.readable_id
              : resourceIsCourseRunEnrollment
                ? resource.run.course.readable_id
                : undefined
        }
        startDate={run?.start_date}
        enrollmentStatus={enrollmentStatus}
        href={buttonHref ?? coursewareUrl}
        endDate={run?.end_date}
        noun={displayNoun}
        isProgram={false}
        b2bContractId={b2bContractId}
        onClick={buttonClick}
      />
    </>
  ) : resourceIsProgram ? (
    <CoursewareButton
      noun={displayNoun}
      isProgram={true}
      enrollmentStatus={enrollmentStatus}
      href={buttonHref ?? programView(resource.id)}
    />
  ) : resourceIsProgramEnrollment ? (
    <CoursewareButton
      noun={displayNoun}
      isProgram={true}
      enrollmentStatus={enrollmentStatus}
      href={buttonHref ?? programView(resource.program.id)}
    />
  ) : null

  const startDateSection = isLoading ? (
    <Skeleton variant="text" width={100} height={24} />
  ) : isAnyCourse && run?.start_date ? (
    <CourseStartCountdown startDate={run.start_date} />
  ) : null

  const menuItems = contextMenuItems.concat(
    isAnyCourse && enrollmentData?.id
      ? getDefaultContextMenuItems(title, enrollmentData)
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
          status={enrollmentStatus ?? undefined}
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
