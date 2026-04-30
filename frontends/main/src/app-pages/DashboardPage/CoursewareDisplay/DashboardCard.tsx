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
  UnenrollProgramDialog,
} from "./DashboardDialogs"
import NiceModal from "@ebay/nice-modal-react"
import {
  enrollmentQueries,
  useCreateB2bEnrollment,
  useCreateEnrollment,
  useCreateVerifiedProgramEnrollment,
} from "api/mitxonline-hooks/enrollment"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { coursePageView, programPageView, programView } from "@/common/urls"
import {
  mitxonlineLegacyUrl,
  getCourseEnrollmentAction,
  getEnrollmentType,
  isVerifiedEnrollmentMode,
} from "@/common/mitxonline"
import { useReplaceBasketItem } from "api/mitxonline-hooks/baskets"
import { EnrollmentStatus, getBestRun, getEnrollmentStatus } from "./helpers"
import {
  CourseWithCourseRunsSerializerV2,
  CourseRunEnrollmentV3,
  V3UserProgramEnrollment,
  CourseRunV2,
  DisplayModeEnum,
} from "@mitodl/mitxonline-api-axios/v2"
import CourseEnrollmentDialog from "@/page-components/EnrollmentDialogs/CourseEnrollmentDialog"

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
      : mitxonlineLegacyUrl(`/programs/${program.readable_id}`)

    if (!hideDetailsUrl && detailsUrl) {
      menuItems.push({
        className: "dashboard-card-menu-item",
        key: "view-program-details",
        label: "View Program Details",
        href: detailsUrl,
      })
    }

    if (
      program.display_mode !== DisplayModeEnum.Course &&
      !isVerifiedEnrollmentMode(resource.data.enrollment_mode)
    ) {
      menuItems.push({
        className: "dashboard-card-menu-item",
        key: "unenroll-program",
        label: "Unenroll",
        onClick: () => {
          NiceModal.show(UnenrollProgramDialog, {
            title,
            programId: program.id,
          })
        },
      })
    }
  }
  if (resource.type === DashboardType.CourseRunEnrollment) {
    const detailsUrl = useProductPages
      ? coursePageView(resource.data.run.course.readable_id)
      : mitxonlineLegacyUrl(`/courses/${resource.data.run.course.readable_id}`)

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

const getTitle = (
  resource: DashboardResource,
  selectedCourseRun?: CourseRunV2 | null,
): string => {
  if (resource.type === DashboardType.Course) {
    return selectedCourseRun?.title ?? resource.data.title
  }
  if (resource.type === DashboardType.CourseRunEnrollment) {
    return resource.data.run.title
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
  const queryClient = useQueryClient()
  const mitxOnlineUser = useQuery(mitxUserQueries.me())
  const createB2bEnrollment = useCreateB2bEnrollment()
  const createEnrollment = useCreateEnrollment()
  const createVerifiedProgramEnrollment = useCreateVerifiedProgramEnrollment()
  const replaceBasketItem = useReplaceBasketItem()

  const normalizeCoursewareUrl = React.useCallback(
    (
      url: string | undefined,
      coursewareId: string | undefined,
    ): string | undefined => {
      if (!url || !coursewareId) {
        return url
      }

      if (url.includes(coursewareId)) {
        return url
      }

      // Canonical MITx courseware paths are `/learn/course/<courseware_id>/home`.
      // If href is still for the source run, rewrite only the courseware_id segment.
      const rewritten = url.replace(
        /(\/learn\/course\/)([^/]+)(\/home\/?)/,
        `$1${coursewareId}$3`,
      )

      return rewritten
    },
    [],
  )

  const enroll = React.useCallback(
    ({
      course,
      readableId,
      selectedRunId,
      href,
      isB2B,
      isVerifiedProgram,
      programCoursewareId,
    }: {
      course: CourseWithCourseRunsSerializerV2
      readableId?: string
      selectedRunId?: number
      href?: string
      isB2B?: boolean
      isVerifiedProgram?: boolean
      programCoursewareId?: string
    }) => {
      if (isB2B) {
        if (!readableId) {
          console.warn("Cannot enroll in B2B course: missing required data", {
            readableId,
            href,
          })
          return
        }
        const matchedRun = (course.courseruns ?? []).find(
          (run) => run.courseware_id === readableId,
        )
        const destinationUrl = href ?? matchedRun?.courseware_url
        if (!destinationUrl) {
          console.warn("Cannot enroll in B2B course: missing destination URL", {
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
            href: destinationUrl,
            readableId,
          })
        } else {
          createB2bEnrollment.mutate(
            { readable_id: readableId },
            {
              onSuccess: async () => {
                try {
                  const enrollments = await queryClient.fetchQuery(
                    enrollmentQueries.courseRunEnrollmentsList(),
                  )
                  const enrolledUrl = enrollments.find(
                    (enrollment) => enrollment.run.courseware_id === readableId,
                  )?.run.courseware_url
                  window.location.href = enrolledUrl ?? destinationUrl
                } catch (error) {
                  console.warn(
                    "Failed to fetch enrollments after B2B enrollment; falling back to destination URL",
                    error,
                  )
                  window.location.href = destinationUrl
                }
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
        const verifiedDestination = normalizeCoursewareUrl(href, readableId)
        createVerifiedProgramEnrollment.mutate(
          { courserun_id: readableId, request_body: [programCoursewareId] },
          {
            onSuccess: () => {
              window.location.href = verifiedDestination ?? href
            },
          },
        )
      } else {
        // Use the explicitly provided run_id when available (e.g., language
        // picker selects a variant run that may not appear in course.courseruns).
        // Fall back to searching course.courseruns by courseware_id, then to
        // getCourseEnrollmentAction for the default run.
        const directRequestedRun = selectedRunId
          ? course.courseruns.find(
              (r) => r.id === selectedRunId && r.is_enrollable,
            )
          : undefined
        const isSyntheticRequestedRun =
          !directRequestedRun && Boolean(selectedRunId && readableId)
        const requestedRun = directRequestedRun
          ? directRequestedRun
          : isSyntheticRequestedRun
            ? // Variant run not in courseruns: build a minimal run descriptor so
              // we can still call createEnrollment with the correct id.
              ({
                id: selectedRunId!,
                courseware_id: readableId!,
              } as CourseRunV2)
            : undefined
        const requestedRunFromReadableId = readableId
          ? course.courseruns.find(
              (r) => r.courseware_id === readableId && r.is_enrollable,
            )
          : undefined
        const enrollableRuns = (course.courseruns ?? []).filter(
          (r) => r.is_enrollable,
        )

        const enrollmentAction =
          // Preserve existing dashboard behavior: when a course has multiple
          // enrollable runs, users should pick a run in the enrollment dialog.
          // Exception: synthetic language-only runs are explicit selections
          // derived from language options and should still allow direct action.
          enrollableRuns.length > 1 && !isSyntheticRequestedRun
            ? getCourseEnrollmentAction(course)
            : (requestedRun ?? requestedRunFromReadableId)
              ? (() => {
                  const chosenRun = requestedRun ?? requestedRunFromReadableId!
                  const enrollmentType = getEnrollmentType(
                    course.courseruns.find((r) => r.id === chosenRun.id)
                      ?.enrollment_modes,
                  )
                  if (enrollmentType === "free") {
                    return { type: "audit" as const, run: chosenRun }
                  }
                  if (enrollmentType === "none") {
                    // For synthetic language-only runs we don't have enrollment_modes,
                    // so attempt an audit enrollment by run id. For normal runs,
                    // defer to the default action picker.
                    return isSyntheticRequestedRun
                      ? { type: "audit" as const, run: chosenRun }
                      : getCourseEnrollmentAction(course)
                  }
                  if (enrollmentType === "paid") {
                    const product = course.courseruns.find(
                      (r) => r.id === chosenRun.id,
                    )?.products?.[0]
                    return product
                      ? { type: "checkout" as const, run: chosenRun, product }
                      : { type: "none" as const }
                  }
                  return getCourseEnrollmentAction(course)
                })()
              : getCourseEnrollmentAction(course)

        if (enrollmentAction.type === "audit") {
          const enrolledCoursewareId =
            readableId ?? enrollmentAction.run.courseware_id
          createEnrollment.mutate(
            { run_id: enrollmentAction.run.id },
            {
              onSuccess: async () => {
                // Fetch fresh enrollment data to get the authoritative
                // courseware_url from the V3 enrollment record, which is
                // reliable for language-variant runs where the V2 run object
                // may have a null or incorrect courseware_url.
                if (enrolledCoursewareId) {
                  try {
                    const enrollments = await queryClient.fetchQuery(
                      enrollmentQueries.courseRunEnrollmentsList(),
                    )
                    const enrolledUrl = enrollments.find(
                      (e) => e.run.courseware_id === enrolledCoursewareId,
                    )?.run.courseware_url
                    if (enrolledUrl) {
                      window.location.href = enrolledUrl
                      return
                    }
                  } catch (error) {
                    console.warn(
                      "Failed to fetch enrollments after enrollment; falling back to computed destination",
                      error,
                    )
                  }
                }
                const destination =
                  normalizeCoursewareUrl(href, enrolledCoursewareId) ??
                  enrollmentAction.run.courseware_url ??
                  href
                if (destination) {
                  window.location.href = destination
                }
              },
            },
          )
          return
        }

        if (enrollmentAction.type === "checkout") {
          replaceBasketItem.mutate(enrollmentAction.product.id)
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
      normalizeCoursewareUrl,
      replaceBasketItem,
      queryClient,
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
  noun: string
  isProgram?: boolean
  isPending?: boolean
  isStaff?: boolean
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
    return {
      text: `Start ${noun}`,
      endIcon: null,
    }
  }
  if (
    (endDate && isInPast(endDate)) ||
    enrollmentStatus === EnrollmentStatus.Completed
  ) {
    return {
      text: `View ${noun}`,
      endIcon: null,
    }
  }
  // Programs show "View Program" when enrolled, courses show "Continue"
  if (isProgram && enrollmentStatus === EnrollmentStatus.Enrolled) {
    return {
      text: `View ${noun}`,
      endIcon: null,
    }
  }
  return {
    text: "Continue",
    endIcon: <RiArrowRightLine />,
  }
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
    isStaff,
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
    // Staff can access courseware even before the course has started
    if (
      (isProgram || hasEnrolled) &&
      (hasStarted || !startDate || isStaff) &&
      href
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

    // Determine if button should be disabled
    // Staff can access courseware even before the course has started
    const isDisabled = Boolean(
      disabled ||
        (!hasEnrolled && !onClick) || // Not enrolled and no click handler
        (hasEnrolled && !href && !onClick) || // Enrolled but no action available
        (hasEnrolled && !!startDate && !hasStarted && !isStaff), // Enrolled but course hasn't started yet
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
        {`Add a certificate for ${formattedPrice}`}
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
  selectedCourseRun?: CourseRunV2 | null
  uiLanguageCode?: string
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
  selectedCourseRun,
  uiLanguageCode: _uiLanguageCode = "en",
}) => {
  const enrollment = useEnrollmentHandler()
  const mitxOnlineUser = enrollment.mitxOnlineUser
  const useProductPages = useFeatureFlagEnabled(
    FeatureFlags.MitxOnlineProductPages,
  )

  const title = getTitle(resource, selectedCourseRun)
  const courseRun =
    resource.type === DashboardType.Course
      ? (selectedCourseRun ??
        getBestRun(resource.data, { enrollableOnly: true, contractId }))
      : undefined
  const enrollmentRun =
    resource.type === DashboardType.CourseRunEnrollment
      ? resource.data.run
      : undefined
  const enrollmentStatus = getDashboardEnrollmentStatus(resource)
  const certificateLink = getCertificateLink(resource)
  const displayNoun = noun ?? getDefaultNoun(resource)

  const isCourse = resource.type === DashboardType.Course
  const isCourseRunEnrollment =
    resource.type === DashboardType.CourseRunEnrollment
  const isProgramEnrollment = resource.type === DashboardType.ProgramEnrollment
  const isAnyCourse = isCourse || isCourseRunEnrollment

  const coursewareUrl = isCourse
    ? courseRun?.courseware_url
    : enrollmentRun?.courseware_url
  const b2bContractId =
    courseRun?.b2b_contract ??
    (resource.type === DashboardType.CourseRunEnrollment
      ? resource.data.b2b_contract_id
      : undefined) ??
    contractId
  // TODO: Replace this inferred contract-page check once include_in_learn_catalog is available in v3.
  const isContractPageResource = Boolean(b2bContractId)

  const hasEnrollableRuns = isCourse
    ? (courseRun?.is_enrollable ?? false)
    : true

  const disableEnrollment = isCourse && !hasEnrollableRuns

  const readableId = isCourse
    ? courseRun?.courseware_id
    : isCourseRunEnrollment
      ? resource.data.run.courseware_id
      : isProgramEnrollment
        ? resource.data.program.readable_id
        : undefined

  const canUpgrade =
    isCourseRunEnrollment &&
    !isVerifiedEnrollmentMode(resource.data.enrollment_mode) &&
    (enrollmentRun?.is_upgradable ?? false) &&
    (enrollmentRun?.upgrade_product_is_active ?? false)

  // Handle enrollment click for courses
  const handleEnrollmentClick = React.useCallback(() => {
    if (isCourse) {
      const isVerifiedProgramEnrollment = isVerifiedEnrollmentMode(
        programEnrollment?.enrollment_mode,
      )

      enrollment.enroll({
        course: resource.data,
        readableId: readableId,
        selectedRunId: courseRun?.id,
        href: buttonHref ?? coursewareUrl ?? undefined,
        isB2B: !!b2bContractId,
        isVerifiedProgram: isVerifiedProgramEnrollment,
        programCoursewareId: programEnrollment?.program.readable_id,
      })
    }
  }, [
    isCourse,
    resource,
    courseRun?.id,
    readableId,
    coursewareUrl,
    b2bContractId,
    buttonHref,
    enrollment,
    programEnrollment?.enrollment_mode,
    programEnrollment?.program.readable_id,
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
      !isVerifiedEnrollmentMode(resource.data.enrollment_mode) &&
      offerUpgrade ? (
        <UpgradeBanner
          data-testid="upgrade-root"
          canUpgrade={canUpgrade}
          certificateUpgradeDeadline={enrollmentRun?.upgrade_deadline}
          certificateUpgradePrice={enrollmentRun?.upgrade_product_price}
          productId={enrollmentRun?.upgrade_product_id}
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
        startDate={isCourse ? courseRun?.start_date : enrollmentRun?.start_date}
        enrollmentStatus={enrollmentStatus}
        href={buttonHref ?? coursewareUrl}
        endDate={isCourse ? courseRun?.end_date : enrollmentRun?.end_date}
        noun={displayNoun}
        isProgram={false}
        disabled={disableEnrollment}
        isPending={enrollment.isPending}
        isStaff={mitxOnlineUser?.is_staff}
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
  ) : isAnyCourse &&
    (isCourse ? courseRun?.start_date : enrollmentRun?.start_date) ? (
    <CourseStartCountdown
      startDate={
        isCourse
          ? (courseRun?.start_date as string)
          : (enrollmentRun?.start_date as string)
      }
    />
  ) : null

  // Build context menu
  const menuItems = getContextMenuItems(
    title,
    resource,
    useProductPages ?? false,
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
