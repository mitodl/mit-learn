import React, { ComponentProps } from "react"
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
import { ProgramAsCourseCard } from "./ProgramAsCourseCard"
import NiceModal from "@ebay/nice-modal-react"
import {
  useCreateB2bEnrollment,
  useCreateVerifiedProgramEnrollment,
} from "api/mitxonline-hooks/enrollment"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { useQuery } from "@tanstack/react-query"
import { coursePageView, programPageView, programView } from "@/common/urls"
import { mitxonlineUrl } from "@/common/mitxonline"
import { useReplaceBasketItem } from "api/mitxonline-hooks/baskets"
import {
  EnrollmentStatus,
  getBestRun,
  getCourseRunEnrollmentStatus,
} from "./helpers"
import {
  CourseWithCourseRunsSerializerV2,
  CourseRunEnrollmentV3,
  V3UserProgramEnrollment,
  CourseRunV2,
  DisplayModeEnum,
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
  | { type: "courserun-enrollment"; data: CourseRunEnrollmentV3 }
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
  additionalItems: SimpleMenuItem[] = [],
  hideDetailsUrl = false,
) => {
  const menuItems = []
  if (resource.type === DashboardType.ProgramEnrollment) {
    const { program } = resource.data
    const detailsUrl = useProductPages
      ? programPageView({
          readable_id: program.readable_id,
          display_mode: program.display_mode,
        })
      : mitxonlineUrl(`/programs/${program.readable_id}`)

    if (!hideDetailsUrl && detailsUrl) {
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
      : mitxonlineUrl(`/courses/${resource.data.run.course.readable_id}`)

    const courseMenuItems = []

    if (!hideDetailsUrl && detailsUrl) {
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
      : getCourseRunEnrollmentStatus(resource.data)
  }

  return hasValidCertificate
    ? EnrollmentStatus.Completed
    : EnrollmentStatus.Enrolled
}

const useEnrollmentHandler = () => {
  const mitxOnlineUser = useQuery(mitxUserQueries.me())
  const createB2bEnrollment = useCreateB2bEnrollment()
  const createVerifiedProgramEnrollment = useCreateVerifiedProgramEnrollment()

  const enroll = React.useCallback(
    ({
      course,
      readableId,
      href,
      isB2B,
      isVerifiedProgram,
      programCoursewareId,
    }: {
      course: CourseWithCourseRunsSerializerV2
      readableId?: string
      href?: string
      isB2B?: boolean
      isVerifiedProgram?: boolean
      programCoursewareId?: string
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
      } else if (isVerifiedProgram && programCoursewareId && readableId) {
        if (!href) {
          console.warn(
            "Cannot enroll in verified program course: missing href",
            { href },
          )
          return
        }
        createVerifiedProgramEnrollment.mutate(
          { courserun_id: readableId, program_id: programCoursewareId },
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
      createVerifiedProgramEnrollment,
    ],
  )

  return {
    enroll,
    isPending:
      createB2bEnrollment.isPending ||
      createVerifiedProgramEnrollment.isPending,
  }
}

type CoursewareButtonProps = {
  startDate?: string | null
  endDate?: string | null
  enrollmentStatus: EnrollmentStatus
  href?: string | null
  disabled?: boolean
  className?: string
  isProgram?: boolean
  isPending?: boolean
  "data-testid"?: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
}

type CoursewareButtonStyleProps = {
  text: string
  endIcon: React.ReactNode
  variant: ComponentProps<typeof Button>["variant"]
}

const getCoursewareButtonStyle = ({
  endDate,
  enrollmentStatus,
  isProgram,
}: {
  endDate?: string | null
  enrollmentStatus: EnrollmentStatus
  isProgram?: boolean
}): CoursewareButtonStyleProps => {
  if (enrollmentStatus === EnrollmentStatus.NotEnrolled) {
    return { text: "Start", endIcon: null, variant: "secondary" }
  }
  if (
    (endDate && isInPast(endDate)) ||
    enrollmentStatus === EnrollmentStatus.Completed
  ) {
    return { text: "View", endIcon: null, variant: "text" }
  }
  // Programs show "View" when enrolled, courses show "Continue"
  if (isProgram && enrollmentStatus === EnrollmentStatus.Enrolled) {
    return { text: "View", endIcon: null, variant: "text" }
  }
  return { text: "Continue", endIcon: <RiArrowRightLine />, variant: "primary" }
}

const CoursewareButton = styled(
  ({
    startDate,
    endDate,
    enrollmentStatus,
    href,
    disabled,
    className,
    isProgram,
    onClick,
    isPending,
    ...others
  }: CoursewareButtonProps) => {
    const coursewareText = getCoursewareButtonStyle({
      endDate,
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
          variant={coursewareText.variant}
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
        variant={coursewareText.variant}
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
  const replaceBasketItem = useReplaceBasketItem()

  const handleUpgradeClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (!productId) return

    try {
      await replaceBasketItem.mutateAsync(productId)
    } catch (error) {
      onError?.(error as Error)
    }
  }

  if (!canUpgrade || !certificateUpgradePrice || !productId) {
    return null
  }

  // If deadline is provided, check it hasn't passed
  if (certificateUpgradeDeadline && isInPast(certificateUpgradeDeadline)) {
    return null
  }

  const formattedPrice = `$${certificateUpgradePrice}`
  const calendarDays = certificateUpgradeDeadline
    ? calendarDaysUntil(certificateUpgradeDeadline)
    : null

  return (
    <SubtitleLinkRoot {...others}>
      <SubtitleLink href="#" onClick={handleUpgradeClick}>
        <RiAddLine size="16px" />
        Add a certificate for {formattedPrice}
      </SubtitleLink>
      {calendarDays !== null && (
        <NoSSR>
          {/* This uses local time. */}
          {formatUpgradeTime(calendarDays)}
        </NoSSR>
      )}
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

type DashboardCardSharedProps = Omit<DashboardCardProps, "resource">

type DashboardCourseResource =
  | { type: "course"; data: CourseWithCourseRunsSerializerV2 }
  | { type: "courserun-enrollment"; data: CourseRunEnrollmentV3 }

type DashboardProgramResource = {
  type: "program-enrollment"
  data: V3UserProgramEnrollment
}

type DashboardCardLayoutProps = {
  titleSection: React.ReactNode
  buttonSection: React.ReactNode
  startDateSection: React.ReactNode
  contextMenu: React.ReactNode
  Component?: React.ElementType
  className?: string
  variant?: "default" | "stacked"
}

const DashboardCardLayout: React.FC<DashboardCardLayoutProps> = ({
  titleSection,
  buttonSection,
  startDateSection,
  contextMenu,
  Component,
  className,
  variant = "default",
}) => {
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

type DashboardCourseCardProps = DashboardCardSharedProps & {
  resource: DashboardCourseResource
  useProductPages: boolean
}

const DashboardCourseCard: React.FC<DashboardCourseCardProps> = ({
  resource,
  showNotComplete = true,
  offerUpgrade = true,
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
  useProductPages,
}) => {
  const enrollment = useEnrollmentHandler()

  const title = getTitle(resource)
  const enrollmentStatus = getDashboardEnrollmentStatus(resource)
  const certificateLink = getCertificateLink(resource)

  const isCourse = resource.type === DashboardType.Course
  const isCourseRunEnrollment =
    resource.type === DashboardType.CourseRunEnrollment

  const courseRun = isCourse ? getBestRun(resource.data, contractId) : undefined
  const enrollmentRun = isCourseRunEnrollment ? resource.data.run : undefined

  const coursewareUrl =
    courseRun?.courseware_url ?? enrollmentRun?.courseware_url
  const b2bContractId =
    courseRun?.b2b_contract ??
    (isCourseRunEnrollment ? resource.data.b2b_contract_id : undefined) ??
    contractId
  // TODO: Replace this inferred contract-page check once include_in_learn_catalog is available in v3.
  const isContractPageResource = isCourse
    ? !resource.data.include_in_learn_catalog
    : Boolean(b2bContractId)

  const hasEnrollableRuns = isCourse
    ? (resource.data.courseruns ?? []).some((run) => run.is_enrollable)
    : true

  const disableEnrollment = isCourse && !hasEnrollableRuns

  const readableId = isCourse
    ? courseRun?.courseware_id
    : isCourseRunEnrollment
      ? resource.data.run.courseware_id
      : undefined

  const canUpgrade =
    isCourseRunEnrollment &&
    resource.data.enrollment_mode !== EnrollmentMode.Verified &&
    (enrollmentRun?.is_upgradable ?? false) &&
    (enrollmentRun?.upgrade_product_is_active ?? false)

  const upgradeProductPrice = enrollmentRun?.upgrade_product_price

  const upgradeProductId = enrollmentRun?.upgrade_product_id

  const handleEnrollmentClick = React.useCallback(() => {
    if (!isCourse) return

    const isVerifiedProgramEnrollment =
      programEnrollment?.enrollment_mode === EnrollmentMode.Verified

    enrollment.enroll({
      course: resource.data,
      readableId,
      href: buttonHref ?? coursewareUrl ?? undefined,
      isB2B: !!b2bContractId,
      isVerifiedProgram: isVerifiedProgramEnrollment,
      programCoursewareId: isVerifiedProgramEnrollment
        ? programEnrollment?.program.readable_id
        : undefined,
    })
  }, [
    b2bContractId,
    buttonHref,
    coursewareUrl,
    enrollment,
    isCourse,
    programEnrollment?.enrollment_mode,
    programEnrollment?.program.readable_id,
    readableId,
    resource,
  ])

  const titleHref = isCourseRunEnrollment ? (buttonHref ?? coursewareUrl) : null
  const titleClick: React.MouseEventHandler | undefined = isCourse
    ? (e) => {
        e.preventDefault()
        handleEnrollmentClick()
      }
    : undefined

  const coursewareButtonClick:
    | React.MouseEventHandler<HTMLButtonElement>
    | undefined = isCourse ? handleEnrollmentClick : buttonClick

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
      ) : (
        <TitleText clickable={Boolean(titleClick)} onClick={titleClick}>
          {title}
        </TitleText>
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
          certificateUpgradeDeadline={enrollmentRun?.upgrade_deadline}
          certificateUpgradePrice={upgradeProductPrice}
          productId={upgradeProductId}
          onError={() => {
            onUpgradeError?.(
              "There was a problem adding the certificate to your cart.",
            )
          }}
        />
      ) : null}
    </>
  )

  const buttonSection = isLoading ? (
    <Skeleton variant="rectangular" width={120} height={32} />
  ) : (
    <>
      <EnrollmentStatusIndicator
        status={enrollmentStatus}
        showNotComplete={showNotComplete}
      />
      <CoursewareButton
        data-testid="courseware-button"
        startDate={courseRun?.start_date ?? enrollmentRun?.start_date}
        enrollmentStatus={enrollmentStatus}
        href={buttonHref ?? coursewareUrl}
        endDate={courseRun?.end_date ?? enrollmentRun?.end_date}
        isProgram={false}
        disabled={disableEnrollment}
        isPending={enrollment.isPending}
        onClick={coursewareButtonClick}
      />
    </>
  )

  const startDateSection = isLoading ? (
    <Skeleton variant="text" width={100} height={24} />
  ) : (courseRun?.start_date ?? enrollmentRun?.start_date) ? (
    <CourseStartCountdown
      startDate={(courseRun?.start_date ?? enrollmentRun?.start_date) as string}
    />
  ) : null

  const menuItems = getContextMenuItems(
    title,
    resource,
    useProductPages,
    contextMenuItems,
    isContractPageResource,
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
    <DashboardCardLayout
      titleSection={titleSection}
      buttonSection={buttonSection}
      startDateSection={startDateSection}
      contextMenu={contextMenu}
      Component={Component}
      className={className}
      variant={variant}
    />
  )
}

type DashboardProgramCardProps = DashboardCardSharedProps & {
  resource: DashboardProgramResource
  useProductPages: boolean
}

const DashboardProgramCard: React.FC<DashboardProgramCardProps> = ({
  resource,
  contextMenuItems = [],
  isLoading = false,
  buttonHref,
  Component,
  className,
  variant = "default",
  useProductPages,
}) => {
  const isCourseDisplayMode =
    resource.data.program.display_mode === DisplayModeEnum.Course

  if (isCourseDisplayMode) {
    return (
      <ProgramAsCourseCard
        programId={resource.data.program.id}
        Component={Component}
        className={className}
      />
    )
  }

  const title = getTitle(resource)
  const enrollmentStatus = getDashboardEnrollmentStatus(resource)
  const certificateLink = getCertificateLink(resource)

  const titleSection = isLoading ? (
    <>
      <Skeleton variant="text" width="95%" height={16} />
      <Skeleton variant="text" width={120} height={16} />
    </>
  ) : (
    <>
      <TitleLink
        size="medium"
        color="black"
        href={programView(resource.data.program.id)}
      >
        {title}
      </TitleLink>
      {certificateLink ? (
        <SubtitleLink href={certificateLink}>
          <RiAwardLine size="16px" />
          View Certificate
        </SubtitleLink>
      ) : null}
    </>
  )

  const buttonSection = isLoading ? (
    <Skeleton variant="rectangular" width={120} height={32} />
  ) : (
    <CoursewareButton
      isProgram={true}
      enrollmentStatus={enrollmentStatus}
      href={buttonHref ?? programView(resource.data.program.id)}
    />
  )

  const startDateSection = isLoading ? (
    <Skeleton variant="text" width={100} height={24} />
  ) : null

  const menuItems = getContextMenuItems(
    title,
    resource,
    useProductPages,
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
    <DashboardCardLayout
      titleSection={titleSection}
      buttonSection={buttonSection}
      startDateSection={startDateSection}
      contextMenu={contextMenu}
      Component={Component}
      className={className}
      variant={variant}
    />
  )
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  resource,
  ...props
}) => {
  const useProductPages = useFeatureFlagEnabled(
    FeatureFlags.MitxOnlineProductPages,
  )

  if (resource.type === DashboardType.ProgramEnrollment) {
    return (
      <DashboardProgramCard
        resource={resource}
        useProductPages={useProductPages ?? false}
        {...props}
      />
    )
  }

  return (
    <DashboardCourseCard
      resource={resource}
      useProductPages={useProductPages ?? false}
      {...props}
    />
  )
}

export {
  DashboardCard,
  DashboardCourseCard,
  DashboardProgramCard,
  CardRoot as DashboardCardRoot,
  MenuButton as DashboardCardMenuButton,
  getContextMenuItems,
}
