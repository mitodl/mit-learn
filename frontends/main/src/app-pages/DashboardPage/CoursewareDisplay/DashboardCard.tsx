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
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"

import { EnrollmentStatusIndicator } from "./EnrollmentStatusIndicator"
import {
  EmailSettingsDialog,
  JustInTimeDialog,
  UnenrollDialog,
} from "./DashboardDialogs"
import NiceModal from "@ebay/nice-modal-react"
import {
  useCreateB2bEnrollment,
  useCreateEnrollment,
} from "api/mitxonline-hooks/enrollment"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { useQuery } from "@tanstack/react-query"
import { coursePageView, programPageView, programView } from "@/common/urls"
import { mitxonlineUrl } from "@/common/mitxonline"
import { useAddToBasket, useClearBasket } from "api/mitxonline-hooks/baskets"
import { EnrollmentStatus, getBestRun, getEnrollmentStatus } from "./helpers"
import {
  CourseWithCourseRunsSerializerV2,
  CourseRunEnrollmentRequestV2,
  V3UserProgramEnrollment,
  CourseRunV2,
} from "@mitodl/mitxonline-api-axios/v2"
import CourseEnrollmentDialog from "@/page-components/EnrollmentDialogs/CourseEnrollmentDialog"

const EnrollmentMode = {
  Audit: "audit",
  Verified: "verified",
} as const
type EnrollmentMode = (typeof EnrollmentMode)[keyof typeof EnrollmentMode]

export const DashboardType = {
  Course: "course",
  CourseRunEnrollment: "courserun-enrollment",
  ProgramEnrollment: "program-enrollment",
} as const
export type DashboardType = (typeof DashboardType)[keyof typeof DashboardType]

export type DashboardResource =
  | { type: "course"; data: CourseWithCourseRunsSerializerV2 }
  | { type: "courserun-enrollment"; data: CourseRunEnrollmentRequestV2 }
  | { type: "program-enrollment"; data: V3UserProgramEnrollment }

/**
 * Gets the certificate link for a dashboard resource based on its type.
 */
const getCertificateLink = (resource: DashboardResource): string | null => {
  if (resource.type === DashboardType.CourseRunEnrollment) {
    const link = resource.data.certificate?.link
    if (!link) return null
    const pattern = /\/certificate\/([^/]+)\/?$/
    return link.replace(pattern, "/certificate/course/$1/")
  }
  if (resource.type === DashboardType.ProgramEnrollment) {
    const link = resource.data.certificate?.link
    if (!link) return null
    const pattern = /\/certificate\/([^/]+)\/?$/
    return link.replace(pattern, "/certificate/program/$1/")
  }
  return null
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

const getContextMenuItems = (
  title: string,
  resource: DashboardResource,
  useProductPages: boolean,
  includeInLearnCatalog: boolean,
  additionalItems: SimpleMenuItem[] = [],
) => {
  const menuItems = []
  if (resource.type === DashboardType.ProgramEnrollment) {
    const detailsUrl = useProductPages
      ? programPageView(resource.data.program.readable_id)
      : mitxonlineUrl(`/programs/${resource.data.program.readable_id}`)

    if (detailsUrl && includeInLearnCatalog) {
      menuItems.push({
        className: "dashboard-card-menu-item",
        key: "view-program-details",
        label: "View Program Details",
        href: detailsUrl,
      })
    }
  }
  if (resource.type === DashboardType.CourseRunEnrollment) {
    const detailsUrl = useProductPages
      ? coursePageView(resource.data.run.course.readable_id)
      : resource.data.run.course.page?.page_url

    const courseMenuItems = []

    if (detailsUrl && includeInLearnCatalog) {
      courseMenuItems.push({
        className: "dashboard-card-menu-item",
        key: "view-course-details",
        label: "View Course Details",
        href: detailsUrl,
      })
    }

    courseMenuItems.push(
      {
        className: "dashboard-card-menu-item",
        key: "email-settings",
        label: "Email Settings",
        onClick: () => {
          NiceModal.show(EmailSettingsDialog, {
            title,
            enrollment: resource.data,
          })
        },
      },
      {
        className: "dashboard-card-menu-item",
        key: "unenroll",
        label: "Unenroll",
        onClick: () => {
          NiceModal.show(UnenrollDialog, { title, enrollment: resource.data })
        },
      },
    )

    menuItems.push(...courseMenuItems)
  }
  return [...menuItems, ...additionalItems]
}

const getTitle = (resource: DashboardResource): string => {
  if (resource.type === DashboardType.Course) {
    return resource.data.title
  }
  if (resource.type === DashboardType.CourseRunEnrollment) {
    return resource.data.run.course.title
  }
  return resource.data.program.title
}

const getRun = (
  resource: DashboardResource,
  contractId?: number,
): CourseRunV2 | undefined => {
  if (resource.type === DashboardType.Course) {
    return getBestRun(resource.data, contractId)
  }
  if (resource.type === DashboardType.CourseRunEnrollment) {
    return resource.data.run
  }
  return undefined
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

const getDefaultNoun = (resource: DashboardResource): string => {
  return resource.type === DashboardType.ProgramEnrollment
    ? "Program"
    : "Course"
}

const useEnrollmentHandler = () => {
  const mitxOnlineUser = useQuery(mitxUserQueries.me())
  const createB2bEnrollment = useCreateB2bEnrollment()
  const createEnrollment = useCreateEnrollment()

  const enroll = React.useCallback(
    ({
      course,
      readableId,
      href,
      isB2B,
      isVerifiedProgram,
      programCourseRunId,
    }: {
      course: CourseWithCourseRunsSerializerV2
      readableId?: string
      href?: string
      isB2B?: boolean
      isVerifiedProgram?: boolean
      programCourseRunId?: number
    }) => {
      if (isB2B) {
        if (!readableId || !href) {
          console.warn("Cannot enroll in B2B course: missing required data", {
            readableId,
            href,
          })
          return
        }
        const userCountry = mitxOnlineUser.data?.legal_address?.country
        const userYearOfBirth = mitxOnlineUser.data?.user_profile?.year_of_birth
        const showJustInTimeDialog = !userCountry || !userYearOfBirth

        if (showJustInTimeDialog) {
          NiceModal.show(JustInTimeDialog, {
            href,
            readableId,
          })
        } else {
          createB2bEnrollment.mutate(
            { readable_id: readableId },
            {
              onSuccess: () => {
                window.location.href = href
              },
            },
          )
        }
      } else if (isVerifiedProgram && programCourseRunId) {
        if (!href) {
          console.warn(
            "Cannot enroll in verified program course: missing href",
            { href },
          )
          return
        }
        createEnrollment.mutate(
          { run_id: programCourseRunId },
          {
            onSuccess: () => {
              window.location.href = href
            },
          },
        )
      } else {
        const onCourseEnroll = (run: CourseRunV2) => {
          window.location.href = run.courseware_url!
        }
        NiceModal.show(CourseEnrollmentDialog, { course, onCourseEnroll })
      }
    },
    [
      mitxOnlineUser.data?.legal_address?.country,
      mitxOnlineUser.data?.user_profile?.year_of_birth,
      createB2bEnrollment,
      createEnrollment,
    ],
  )

  return {
    enroll,
    isPending: createB2bEnrollment.isPending || createEnrollment.isPending,
  }
}

type CoursewareButtonProps = {
  startDate?: string | null
  endDate?: string | null
  enrollmentStatus: EnrollmentStatus
  href?: string | null
  disabled?: boolean
  className?: string
  noun: string
  isProgram?: boolean
  isPending?: boolean
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
  enrollmentStatus: EnrollmentStatus
  noun: string
  isProgram?: boolean
}) => {
  if (enrollmentStatus === EnrollmentStatus.NotEnrolled) {
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
    startDate,
    endDate,
    enrollmentStatus,
    href,
    disabled,
    className,
    noun,
    isProgram,
    onClick,
    isPending,
    ...others
  }: CoursewareButtonProps) => {
    const coursewareText = getCoursewareTextAndIcon({
      endDate,
      noun,
      enrollmentStatus,
      isProgram,
    })
    const hasStarted = startDate && isInPast(startDate)
    const hasEnrolled = enrollmentStatus !== EnrollmentStatus.NotEnrolled

    // Programs or enrolled courses with started runs: show link
    if ((isProgram || hasEnrolled) && (hasStarted || !startDate) && href) {
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

    // Determine if button should be disabled
    const isDisabled = Boolean(
      disabled ||
        (!hasEnrolled && !onClick) || // Not enrolled and no click handler
        (hasEnrolled && !!startDate && !hasStarted), // Enrolled but course hasn't started yet
    )

    return (
      <Button
        size="small"
        variant="primary"
        className={className}
        onClick={onClick}
        disabled={isDisabled}
        endIcon={
          isPending ? (
            <LoadingSpinner color="inherit" loading={isPending} size={16} />
          ) : (
            coursewareText.endIcon
          )
        }
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
    productId?: number | null
    onError?: (error: Error) => void
  } & React.HTMLAttributes<HTMLDivElement>
> = ({
  canUpgrade,
  certificateUpgradeDeadline,
  certificateUpgradePrice,
  productId,
  onError,
  ...others
}) => {
  const addToBasket = useAddToBasket()
  const clearBasket = useClearBasket()

  const handleUpgradeClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (!productId) return

    try {
      // Reset mutation state to allow retry after error
      addToBasket.reset()
      clearBasket.reset()

      await clearBasket.mutateAsync()
      await addToBasket.mutateAsync(productId)
    } catch (error) {
      onError?.(error as Error)
    }
  }

  if (!canUpgrade || !certificateUpgradeDeadline || !certificateUpgradePrice) {
    return null
  }
  if (isInPast(certificateUpgradeDeadline)) return null
  const calendarDays = calendarDaysUntil(certificateUpgradeDeadline)
  if (calendarDays === null) return null
  const formattedPrice = `$${certificateUpgradePrice}`
  return (
    <SubtitleLinkRoot {...others}>
      <SubtitleLink href="#" onClick={handleUpgradeClick}>
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
  programEnrollment?: V3UserProgramEnrollment
  onUpgradeError?: (error: string) => void
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  resource,
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
  programEnrollment,
  onUpgradeError,
}) => {
  const enrollment = useEnrollmentHandler()
  const useProductPages = useFeatureFlagEnabled(
    FeatureFlags.MitxOnlineProductPages,
  )

  const title = getTitle(resource)
  const run = getRun(resource, contractId)
  const enrollmentStatus = getDashboardEnrollmentStatus(resource)
  const certificateLink = getCertificateLink(resource)
  const displayNoun = noun ?? getDefaultNoun(resource)

  const isCourse = resource.type === DashboardType.Course
  const isCourseRunEnrollment =
    resource.type === DashboardType.CourseRunEnrollment
  const isProgramEnrollment = resource.type === DashboardType.ProgramEnrollment
  const isAnyCourse = isCourse || isCourseRunEnrollment

  const coursewareUrl = run?.courseware_url
  const b2bContractId = run?.b2b_contract ?? contractId

  const hasEnrollableRuns = isCourse
    ? (resource.data.courseruns ?? []).some((run) => run.is_enrollable)
    : true

  const disableEnrollment = isCourse && !hasEnrollableRuns

  const readableId = isCourse
    ? run?.courseware_id
    : isCourseRunEnrollment
      ? resource.data.run.courseware_id
      : isProgramEnrollment
        ? resource.data.program.readable_id
        : undefined

  const includeInLearnCatalog = isCourse
    ? resource.data.include_in_learn_catalog
    : isCourseRunEnrollment
      ? resource.data.run.course.include_in_learn_catalog
      : true

  const canUpgrade =
    isCourseRunEnrollment &&
    resource.data.enrollment_mode !== EnrollmentMode.Verified &&
    (run?.is_upgradable ?? false)

  // Handle enrollment click for courses
  const handleEnrollmentClick = React.useCallback(() => {
    if (isCourse) {
      const isVerifiedProgramEnrollment =
        programEnrollment?.enrollment_mode === EnrollmentMode.Verified

      enrollment.enroll({
        course: resource.data,
        readableId: readableId,
        href: buttonHref ?? coursewareUrl ?? undefined,
        isB2B: !!b2bContractId,
        isVerifiedProgram: isVerifiedProgramEnrollment,
        programCourseRunId: isVerifiedProgramEnrollment ? run?.id : undefined,
      })
    }
  }, [
    isCourse,
    resource,
    readableId,
    coursewareUrl,
    b2bContractId,
    run?.id,
    buttonHref,
    enrollment,
    programEnrollment?.enrollment_mode,
  ])

  // Determine title behavior (link vs clickable text vs plain text)
  const titleHref = isCourseRunEnrollment
    ? (buttonHref ?? coursewareUrl)
    : isProgramEnrollment
      ? programView(resource.data.program.id)
      : undefined

  const titleClick: React.MouseEventHandler | undefined = isCourse
    ? (e) => {
        e.preventDefault()
        handleEnrollmentClick()
      }
    : undefined

  // Button onClick handler
  const coursewareButtonClick:
    | React.MouseEventHandler<HTMLButtonElement>
    | undefined = isCourse ? handleEnrollmentClick : buttonClick

  // Build title section
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
      {certificateLink ? (
        <SubtitleLink href={certificateLink}>
          <RiAwardLine size="16px" />
          View Certificate
        </SubtitleLink>
      ) : null}
      {isCourseRunEnrollment &&
      resource.data.enrollment_mode !== EnrollmentMode.Verified &&
      offerUpgrade ? (
        <UpgradeBanner
          data-testid="upgrade-root"
          canUpgrade={canUpgrade}
          certificateUpgradeDeadline={run?.upgrade_deadline}
          certificateUpgradePrice={run?.products?.[0]?.price}
          productId={run?.products?.[0]?.id}
          onError={() => {
            onUpgradeError?.(
              "There was a problem adding the certificate to your cart.",
            )
          }}
        />
      ) : null}
    </>
  )

  // Build button section
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
        startDate={run?.start_date}
        enrollmentStatus={enrollmentStatus}
        href={buttonHref ?? coursewareUrl}
        endDate={run?.end_date}
        noun={displayNoun}
        isProgram={false}
        disabled={disableEnrollment}
        isPending={enrollment.isPending}
        onClick={coursewareButtonClick}
      />
    </>
  ) : isProgramEnrollment &&
    resource.type === DashboardType.ProgramEnrollment ? (
    <CoursewareButton
      noun={displayNoun}
      isProgram={true}
      enrollmentStatus={enrollmentStatus}
      href={buttonHref ?? programView(resource.data.program.id)}
    />
  ) : null

  // Build start date section
  const startDateSection = isLoading ? (
    <Skeleton variant="text" width={100} height={24} />
  ) : isAnyCourse && run?.start_date ? (
    <CourseStartCountdown startDate={run.start_date} />
  ) : null

  // Build context menu
  const menuItems = getContextMenuItems(
    title,
    resource,
    useProductPages ?? false,
    includeInLearnCatalog,
    contextMenuItems,
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
          status={enrollmentStatus}
          hidden={menuItems.length === 0}
        >
          <RiMore2Line />
        </MenuButton>
      }
    />
  )

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

export { DashboardCard, CardRoot as DashboardCardRoot, getContextMenuItems }
