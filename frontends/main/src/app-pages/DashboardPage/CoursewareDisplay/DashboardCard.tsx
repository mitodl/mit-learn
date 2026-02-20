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
import { useCreateB2bEnrollment } from "api/mitxonline-hooks/enrollment"
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
} from "@mitodl/mitxonline-api-axios/v2"

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

type DashboardResource =
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
  disabled?: boolean
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
    disabled,
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
          disabled={disabled}
          {...others}
        >
          {coursewareText.text}
        </Button>
      )
    }

    if (!hasEnrolled /* enrollment flow */) {
      return (
        <Button
          size="small"
          variant="primary"
          className={className}
          disabled={
            oneClickEnroll.isPending || !coursewareId || !readableId || disabled
          }
          onClick={
            onClick ??
            (() => {
              if (!coursewareId || !readableId || !href) return
              if (b2bContractId) {
                oneClickEnroll.mutate({ href, coursewareId: readableId })
              } else {
                alert("Non-B2B enrollment is not yet available.")
              }
            })
          }
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
  onUpgradeError,
}) => {
  const oneClickEnroll = useOneClickEnroll()
  const { data: user } = useQuery(mitxUserQueries.me())
  const useProductPages = useFeatureFlagEnabled(
    FeatureFlags.MitxOnlineProductPages,
  )

  // Determine resource type from discriminated union
  const resourceIsCourse = resource.type === DashboardType.Course
  const resourceIsCourseRunEnrollment =
    resource.type === DashboardType.CourseRunEnrollment
  const resourceIsProgramEnrollment =
    resource.type === DashboardType.ProgramEnrollment

  const handleEnrollment = (
    href: string,
    readableId: string,
    hasB2bContract: boolean,
  ) => {
    if (!hasB2bContract) {
      alert("Non-B2B enrollment is not yet available.")
      return
    }

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
  const isAnyCourse = resourceIsCourse || resourceIsCourseRunEnrollment

  // Compute default noun based on resource type
  const defaultNoun = isAnyCourse
    ? "Course"
    : resourceIsProgramEnrollment
      ? "Program"
      : "Unknown"
  const displayNoun = noun ?? defaultNoun

  // Extract common data based on resource type
  const title =
    resource.type === DashboardType.Course
      ? resource.data.title
      : resource.type === DashboardType.CourseRunEnrollment
        ? resource.data.run.course.title
        : resource.data.program.title

  // Course-specific data
  const run = resourceIsCourse
    ? getBestRun(resource.data, contractId)
    : resourceIsCourseRunEnrollment
      ? resource.data.run
      : undefined

  const hasValidCertificate =
    resource.type !== DashboardType.Course && !!resource.data.certificate?.uuid

  const enrollmentStatus: EnrollmentStatus = isAnyCourse
    ? hasValidCertificate
      ? EnrollmentStatus.Completed
      : resource.type === DashboardType.CourseRunEnrollment
        ? getEnrollmentStatus(resource.data)
        : EnrollmentStatus.NotEnrolled
    : hasValidCertificate
      ? EnrollmentStatus.Completed
      : EnrollmentStatus.Enrolled

  // URLs
  const coursewareUrl = run?.courseware_url
  const hasEnrolled =
    isAnyCourse && enrollmentStatus !== EnrollmentStatus.NotEnrolled
  // Check enrollment's b2b_contract_id first, then run's b2b_contract, finally fall back to contractId prop
  const b2bContractId =
    resource.type === DashboardType.CourseRunEnrollment
      ? (resource.data.b2b_contract_id ?? run?.b2b_contract ?? contractId)
      : (run?.b2b_contract ?? contractId)
  const hasEnrollableRuns = resourceIsCourse
    ? (resource.data.courseruns ?? []).some((run) => run.is_enrollable)
    : true
  const disableEnrollment = resourceIsCourse && !hasEnrollableRuns

  const titleHref = isAnyCourse
    ? hasEnrolled
      ? (buttonHref ?? coursewareUrl)
      : undefined
    : resourceIsProgramEnrollment
      ? programView(resource.data.program.id)
      : undefined

  const titleClick: React.MouseEventHandler | undefined =
    isAnyCourse && !hasEnrolled
      ? (e) => {
          e.preventDefault()
          const readableId = resourceIsCourse
            ? run?.courseware_id
            : resourceIsCourseRunEnrollment
              ? resource.data.run.courseware_id
              : undefined
          const targetUrl = buttonHref ?? coursewareUrl
          if (!readableId || !targetUrl) return
          handleEnrollment(targetUrl, readableId, !!b2bContractId)
        }
      : undefined

  const coursewareButtonClick:
    | React.MouseEventHandler<HTMLButtonElement>
    | undefined =
    isAnyCourse && !hasEnrolled
      ? () => {
          const readableId = resourceIsCourse
            ? run?.courseware_id
            : resourceIsCourseRunEnrollment
              ? resource.data.run.courseware_id
              : undefined
          const targetUrl = buttonHref ?? coursewareUrl
          if (!readableId || !targetUrl) return
          handleEnrollment(targetUrl, readableId, !!b2bContractId)
        }
      : buttonClick
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
      {getCertificateLink(resource) ? (
        <SubtitleLink href={getCertificateLink(resource)!}>
          <RiAwardLine size="16px" />
          View Certificate
        </SubtitleLink>
      ) : null}
      {isAnyCourse &&
      resource.type === DashboardType.CourseRunEnrollment &&
      resource.data.enrollment_mode !== EnrollmentMode.Verified &&
      offerUpgrade ? (
        <UpgradeBanner
          data-testid="upgrade-root"
          canUpgrade={run?.is_upgradable ?? false}
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
          resourceIsCourse
            ? run?.courseware_id
            : resourceIsCourseRunEnrollment
              ? resource.data.run.courseware_id
              : undefined
        }
        readableId={
          resourceIsCourse
            ? run?.courseware_id
            : resourceIsCourseRunEnrollment
              ? resource.data.run.courseware_id
              : undefined
        }
        startDate={run?.start_date}
        enrollmentStatus={enrollmentStatus}
        href={buttonHref ?? coursewareUrl}
        endDate={run?.end_date}
        noun={displayNoun}
        isProgram={false}
        b2bContractId={b2bContractId}
        disabled={disableEnrollment}
        onClick={coursewareButtonClick}
      />
    </>
  ) : resourceIsProgramEnrollment ? (
    <CoursewareButton
      noun={displayNoun}
      isProgram={true}
      enrollmentStatus={enrollmentStatus}
      href={buttonHref ?? programView(resource.data.program.id)}
    />
  ) : null

  const startDateSection = isLoading ? (
    <Skeleton variant="text" width={100} height={24} />
  ) : isAnyCourse && run?.start_date ? (
    <CourseStartCountdown startDate={run.start_date} />
  ) : null

  const includeInLearnCatalog = resourceIsCourse
    ? resource.data.include_in_learn_catalog
    : resourceIsCourseRunEnrollment
      ? resource.data.run.course.include_in_learn_catalog
      : resourceIsProgramEnrollment
        ? true
        : false
  const menuItems = getContextMenuItems(
    title,
    resource,
    useProductPages ?? false,
    includeInLearnCatalog ?? false,
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

export { DashboardCard, CardRoot as DashboardCardRoot, getContextMenuItems }
