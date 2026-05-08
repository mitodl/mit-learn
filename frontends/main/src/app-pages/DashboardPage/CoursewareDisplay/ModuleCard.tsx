import React, { ComponentProps } from "react"
import {
  styled,
  Link,
  SimpleMenu,
  SimpleMenuItem,
  Stack,
  Skeleton,
} from "ol-components"
import NextLink from "next/link"
import { ActionButton, Button, ButtonLink } from "@mitodl/smoot-design"
import { RiAddLine, RiMore2Line, RiAwardLine } from "@remixicon/react"
import { calendarDaysUntil, isInPast, NoSSR } from "ol-utilities"

import {
  EmailSettingsDialog,
  JustInTimeDialog,
  UnenrollDialog,
} from "./DashboardDialogs"
import NiceModal from "@ebay/nice-modal-react"
import {
  useCreateB2bEnrollment,
  useCreateEnrollment,
  useCreateVerifiedProgramEnrollment,
} from "api/mitxonline-hooks/enrollment"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { useQuery } from "@tanstack/react-query"
import {
  getCourseEnrollmentAction,
  mitxonlineLegacyUrl,
} from "@/common/mitxonline"
import { useReplaceBasketItem } from "api/mitxonline-hooks/baskets"
import { EnrollmentStatus, getBestRun, getEnrollmentStatus } from "./helpers"
import { getReceiptMenuItem } from "./receiptMenuItem"
import {
  CourseWithCourseRunsSerializerV2,
  CourseRunEnrollmentV3,
  CourseRunV2,
  EnrollmentModeEnum,
} from "@mitodl/mitxonline-api-axios/v2"
import CourseEnrollmentDialog from "@/page-components/EnrollmentDialogs/CourseEnrollmentDialog"

export const DashboardType = {
  Course: "course",
  CourseRunEnrollment: "courserun-enrollment",
} as const
export type DashboardType = (typeof DashboardType)[keyof typeof DashboardType]

export type DashboardResource =
  | { type: "course"; data: CourseWithCourseRunsSerializerV2 }
  | { type: "courserun-enrollment"; data: CourseRunEnrollmentV3 }

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

const HorizontalSeparator = styled.div(({ theme }) => ({
  width: "1px",
  height: "12px",
  backgroundColor: theme.custom.colors.lightGray2,
}))

// This override should not be necessary, small size buttons maybe need an update in smoot-design
const COURSEWARE_BUTTON_WIDTH = "88px"

const StyledCoursewareButton = styled(Button)(({ theme, variant }) => ({
  width: COURSEWARE_BUTTON_WIDTH,
  minWidth: COURSEWARE_BUTTON_WIDTH,
  ...(variant === "text" && {
    color: theme.custom.colors.silverGrayDark,
  }),
}))

const StyledCoursewareButtonLink = styled(ButtonLink)(({ theme, variant }) => ({
  width: COURSEWARE_BUTTON_WIDTH,
  minWidth: COURSEWARE_BUTTON_WIDTH,
  ...(variant === "text" && {
    color: theme.custom.colors.silverGrayDark,
  }),
}))

const CoursewareActionColumn = styled(Stack)({
  width: COURSEWARE_BUTTON_WIDTH,
  flexShrink: 0,
})

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
  additionalItems: SimpleMenuItem[] = [],
  hideDetailsUrl = false,
) => {
  const menuItems = []
  if (resource.type === DashboardType.CourseRunEnrollment) {
    const detailsUrl = mitxonlineLegacyUrl(
      `/courses/${resource.data.run.course.readable_id}`,
    )

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

    const receiptMenuItem = getReceiptMenuItem(
      resource.data.enrollment_mode,
      `/orders/receipt/by-run/${resource.data.run.id}/`,
    )
    if (receiptMenuItem) courseMenuItems.push(receiptMenuItem)

    menuItems.push(...courseMenuItems)
  }
  return [...menuItems, ...additionalItems]
}

const getTitle = (resource: DashboardResource): string => {
  if (resource.type === DashboardType.Course) {
    return resource.data.title
  }
  return resource.data.run.course.title
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

  return EnrollmentStatus.NotEnrolled
}

const useEnrollmentHandler = () => {
  const mitxOnlineUser = useQuery(mitxUserQueries.me())
  const createB2bEnrollment = useCreateB2bEnrollment()
  const createEnrollment = useCreateEnrollment()
  const createVerifiedProgramEnrollment = useCreateVerifiedProgramEnrollment()
  const replaceBasketItem = useReplaceBasketItem()

  const enroll = React.useCallback(
    ({
      courseRun,
      course,
      isB2B,
      useVerifiedEnrollment,
      parentProgramIds,
    }: {
      courseRun: CourseRunV2
      course: CourseWithCourseRunsSerializerV2
      isB2B?: boolean
      useVerifiedEnrollment?: boolean
      parentProgramIds?: string[]
    }) => {
      const readableId = courseRun.courseware_id
      const href = courseRun.courseware_url
      if (!readableId || !href) {
        console.warn("Cannot enroll: missing required data", {
          readableId,
          href,
        })
        return
      }
      if (isB2B) {
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
      } else if (useVerifiedEnrollment && parentProgramIds?.length) {
        createVerifiedProgramEnrollment.mutate(
          {
            courserun_id: readableId,
            request_body: parentProgramIds,
          },
          {
            onSuccess: () => {
              window.location.href = href
            },
          },
        )
      } else {
        const enrollmentDecision = getCourseEnrollmentAction(course)

        if (enrollmentDecision.type === "audit") {
          createEnrollment.mutate(
            { run_id: enrollmentDecision.run.id },
            {
              onSuccess: () => {
                const destination =
                  enrollmentDecision.run.courseware_url ?? href
                if (destination) {
                  window.location.href = destination
                }
              },
            },
          )
          return
        }

        if (enrollmentDecision.type === "checkout") {
          replaceBasketItem.mutate(enrollmentDecision.product.id)
          return
        }

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
      createVerifiedProgramEnrollment,
      replaceBasketItem,
    ],
  )

  return {
    enroll,
    isPending:
      createB2bEnrollment.isPending ||
      createEnrollment.isPending ||
      createVerifiedProgramEnrollment.isPending ||
      replaceBasketItem.isPending,
    mitxOnlineUser: mitxOnlineUser.data,
  }
}

type CoursewareButtonProps = {
  startDate?: string | null
  endDate?: string | null
  enrollmentStatus: EnrollmentStatus
  href?: string | null
  disabled?: boolean
  className?: string
  isStaff?: boolean
  "data-testid"?: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
}

type CoursewareButtonStyleProps = {
  text: string
  variant: ComponentProps<typeof Button>["variant"]
}

export const getCoursewareButtonStyle = ({
  endDate,
  enrollmentStatus,
}: {
  endDate?: string | null
  enrollmentStatus: EnrollmentStatus
}): CoursewareButtonStyleProps => {
  if (enrollmentStatus === EnrollmentStatus.NotEnrolled) {
    return { text: "Start", variant: "secondary" }
  }
  if (
    (endDate && isInPast(endDate)) ||
    enrollmentStatus === EnrollmentStatus.Completed
  ) {
    return { text: "View", variant: "text" }
  }
  return { text: "Continue", variant: "primary" }
}

const CoursewareButton = styled(
  ({
    startDate,
    endDate,
    enrollmentStatus,
    href,
    disabled,
    className,
    onClick,
    isStaff,
    ...others
  }: CoursewareButtonProps) => {
    const coursewareText = getCoursewareButtonStyle({
      endDate,
      enrollmentStatus,
    })
    const hasStarted = startDate && isInPast(startDate)
    const hasEnrolled = enrollmentStatus !== EnrollmentStatus.NotEnrolled

    // Staff can access courseware even before the course has started
    if (hasEnrolled && (hasStarted || !startDate || isStaff) && href) {
      return (
        <StyledCoursewareButtonLink
          size="small"
          variant={coursewareText.variant}
          href={href}
          className={className}
          {...others}
        >
          {coursewareText.text}
        </StyledCoursewareButtonLink>
      )
    }

    // Determine if button should be disabled
    // Staff can access courseware even before the course has started
    const isDisabled = Boolean(
      disabled ||
        (!hasEnrolled && !onClick) || // Not enrolled and no click handler
        (hasEnrolled && !href && !onClick) || // Enrolled but no action available
        (hasEnrolled && !!startDate && !hasStarted && !isStaff), // Enrolled but course hasn't started yet
    )

    return (
      <StyledCoursewareButton
        size="small"
        variant={coursewareText.variant}
        className={className}
        onClick={onClick}
        disabled={isDisabled}
        {...others}
      >
        {coursewareText.text}
      </StyledCoursewareButton>
    )
  },
)(() => ({
  width: COURSEWARE_BUTTON_WIDTH,
  minWidth: COURSEWARE_BUTTON_WIDTH,
}))

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
  color: theme.custom.colors.silverGrayDark,
  ...theme.typography.subtitle3,
}))

const SubtitleLink = styled(NextLink)(({ theme }) => ({
  ...theme.typography.subtitle3,
  color: theme.custom.colors.silverGrayDark,
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

const CountdownRoot = styled.div({
  width: COURSEWARE_BUTTON_WIDTH,
  display: "flex",
  justifyContent: "center",
  whiteSpace: "nowrap",
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
      <Link color="black" size="small" className={className}>
        {value}
      </Link>
    </CountdownRoot>
  )
}

type DashboardCardProps = {
  resource: DashboardResource
  offerUpgrade?: boolean
  contextMenuItems?: SimpleMenuItem[]
  isLoading?: boolean
  buttonHref?: string | null
  buttonClick?: React.MouseEventHandler<HTMLButtonElement>
  Component?: React.ElementType
  className?: string
  variant?: "default" | "stacked"
  contractId?: number
  useVerifiedEnrollment?: boolean
  parentProgramIds?: string[]
  onUpgradeError?: (error: string) => void
  headingLevel?: "h2" | "h3" | "h4" | "h5" | "h6"
}

type DashboardCardSharedProps = Omit<DashboardCardProps, "resource">

type DashboardCourseResource =
  | { type: "course"; data: CourseWithCourseRunsSerializerV2 }
  | { type: "courserun-enrollment"; data: CourseRunEnrollmentV3 }

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
}

const DashboardCourseCard: React.FC<DashboardCourseCardProps> = ({
  resource,
  offerUpgrade = true,
  contextMenuItems = [],
  isLoading = false,
  buttonHref,
  buttonClick,
  Component,
  className,
  variant = "default",
  contractId,
  useVerifiedEnrollment,
  parentProgramIds,
  onUpgradeError,
  headingLevel = "h3",
}) => {
  const enrollment = useEnrollmentHandler()
  const mitxOnlineUser = enrollment.mitxOnlineUser

  const title = getTitle(resource)
  const enrollmentStatus = getDashboardEnrollmentStatus(resource)
  const certificateLink = getCertificateLink(resource)

  const isCourse = resource.type === DashboardType.Course
  const isCourseRunEnrollment =
    resource.type === DashboardType.CourseRunEnrollment

  const courseRun = isCourse
    ? getBestRun(resource.data, { contractId })
    : undefined
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

  const canUpgrade =
    isCourseRunEnrollment &&
    resource.data.enrollment_mode !== EnrollmentModeEnum.Verified &&
    (enrollmentRun?.is_upgradable ?? false) &&
    (enrollmentRun?.upgrade_product_is_active ?? false)

  const upgradeProductPrice = enrollmentRun?.upgrade_product_price

  const upgradeProductId = enrollmentRun?.upgrade_product_id

  const handleEnrollmentClick = React.useCallback(() => {
    if (!isCourse || !courseRun) return

    enrollment.enroll({
      courseRun,
      course: resource.data,
      isB2B: !!b2bContractId,
      useVerifiedEnrollment,
      parentProgramIds,
    })
  }, [
    b2bContractId,
    enrollment,
    isCourse,
    useVerifiedEnrollment,
    parentProgramIds,
    resource,
    courseRun,
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
        <TitleHeading as={headingLevel}>
          <TitleLink
            size="medium"
            color="black"
            href={titleHref}
            onClick={titleClick}
          >
            {title}
          </TitleLink>
        </TitleHeading>
      ) : (
        <TitleText
          as={headingLevel}
          clickable={Boolean(titleClick)}
          onClick={titleClick}
        >
          {title}
        </TitleText>
      )}
    </>
  )

  const showUpgradeLink =
    isCourseRunEnrollment &&
    resource.data.enrollment_mode !== EnrollmentModeEnum.Verified &&
    offerUpgrade
  const showCertificateSection = certificateLink || showUpgradeLink
  const startDate = courseRun?.start_date ?? enrollmentRun?.start_date

  const buttonSection = isLoading ? (
    <Skeleton variant="rectangular" width={120} height={32} />
  ) : (
    <Stack direction="column" gap="4px" alignItems="stretch">
      <Stack direction="row" gap="8px" alignItems="center">
        {certificateLink ? (
          <SubtitleLink href={certificateLink}>
            <RiAwardLine size="16px" />
            Certificate
          </SubtitleLink>
        ) : null}
        {showUpgradeLink ? (
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
        {showCertificateSection ? <HorizontalSeparator /> : null}
        <CoursewareActionColumn direction="row" justifyContent="center">
          <CoursewareButton
            data-testid="courseware-button"
            startDate={startDate}
            enrollmentStatus={enrollmentStatus}
            href={buttonHref ?? coursewareUrl}
            endDate={courseRun?.end_date ?? enrollmentRun?.end_date}
            disabled={disableEnrollment}
            isStaff={mitxOnlineUser?.is_staff}
            onClick={coursewareButtonClick}
          />
        </CoursewareActionColumn>
      </Stack>
      {startDate ? (
        <CoursewareActionColumn
          direction="row"
          justifyContent="center"
          alignSelf="flex-end"
        >
          <CourseStartCountdown startDate={startDate} />
        </CoursewareActionColumn>
      ) : null}
    </Stack>
  )

  const startDateSection = isLoading ? (
    <Skeleton variant="text" width={100} height={24} />
  ) : null

  const menuItems = getContextMenuItems(
    title,
    resource,
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

const DashboardCard: React.FC<DashboardCardProps> = ({
  resource,
  ...props
}) => {
  return <DashboardCourseCard resource={resource} {...props} />
}

export {
  DashboardCard,
  DashboardCourseCard,
  CardRoot as DashboardCardRoot,
  MenuButton as DashboardCardMenuButton,
  getContextMenuItems,
}
