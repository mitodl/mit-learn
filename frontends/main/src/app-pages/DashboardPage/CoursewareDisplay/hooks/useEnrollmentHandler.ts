import { useReplaceBasketItem } from "@/common/mitxonline/useReplaceBasketItem"
import {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import {
  useCreateB2bEnrollment,
  useCreateEnrollment,
  useCreateVerifiedProgramEnrollment,
} from "api/mitxonline-hooks/enrollment"
import React from "react"
import NiceModal from "@ebay/nice-modal-react"
import { getCourseEnrollmentAction } from "@/common/mitxonline"
import { useComplianceGate } from "@/common/mitxonline/useComplianceGate"
import CourseEnrollmentDialog from "@/page-components/EnrollmentDialogs/CourseEnrollmentDialog"
import { trackCourseEnrolled } from "@/common/analytics/gtm"
import { canOpenCourseware } from "../courseDateUtils"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { useQuery } from "@tanstack/react-query"

/**
 * Enrolling before a run starts is allowed, but its courseware isn't open yet,
 * so a successful enrollment must not send the learner there. Shares
 * `canOpenCourseware` with the enrolled card, so the learner lands back on a
 * card whose button agrees with what just happened.
 */
const goToCourseware = (
  url: string,
  startDate?: string | null,
  isStaff?: boolean,
) => {
  if (!canOpenCourseware(startDate, { isStaff })) return
  window.location.href = url
}

const ENROLL_COURSE_ERROR =
  "Something went wrong enrolling you in this course. Please try again."
const ENROLL_PROGRAM_ERROR =
  "Something went wrong enrolling you in this program. Please try again."

export const useEnrollmentHandler = () => {
  const createB2bEnrollment = useCreateB2bEnrollment({
    meta: { errorMessage: ENROLL_COURSE_ERROR },
  })
  const createEnrollment = useCreateEnrollment({
    meta: { errorMessage: ENROLL_COURSE_ERROR },
  })
  const createVerifiedProgramEnrollment = useCreateVerifiedProgramEnrollment({
    meta: { errorMessage: ENROLL_PROGRAM_ERROR },
  })
  const replaceBasketItem = useReplaceBasketItem()
  const { ensureCompliance } = useComplianceGate()
  const mitxOnlineUser = useQuery(mitxUserQueries.me())
  const isStaff = mitxOnlineUser.data?.is_staff

  const enroll = React.useCallback(
    async ({
      course,
      readableId,
      href,
      selectedCoursewareUrl,
      isB2B,
      isVerifiedProgram,
      programCoursewareId,
      programReadableIds,
      b2bProgramId,
      startDate,
    }: {
      course: CourseWithCourseRunsSerializerV2
      readableId?: string
      href?: string
      selectedCoursewareUrl?: string
      isB2B?: boolean
      isVerifiedProgram?: boolean
      programCoursewareId?: string
      programReadableIds?: string[]
      b2bProgramId?: string
      startDate?: string | null
    }) => {
      if (isB2B) {
        if (!readableId) {
          console.warn("Cannot enroll in B2B course: missing required data", {
            readableId,
            href,
          })
          return
        }
        // A selected variant run may not be present in `course.courseruns`
        // (variant runs come from a separate endpoint and aren't always in the
        // course payload), so this find() can miss. `href` is the displayed
        // run's URL, passed explicitly by the card for exactly this reason — it
        // must take precedence, or variant enrollment redirects silently break.
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
        if (!(await ensureCompliance())) return

        createB2bEnrollment.mutate(
          {
            readable_id: readableId,
            B2BEnrollRequestRequest: b2bProgramId
              ? { program_id: b2bProgramId }
              : undefined,
          },
          {
            onSuccess: () => {
              goToCourseware(destinationUrl, startDate, isStaff)
            },
          },
        )
      } else if (
        isVerifiedProgram &&
        readableId &&
        (programReadableIds?.length || programCoursewareId)
      ) {
        if (!href) {
          console.warn(
            "Cannot enroll in verified program course: missing href",
            { href },
          )
          return
        }
        // See the B2B note above: the displayed run may be absent from
        // course.courseruns, so selectedCoursewareUrl/href must take precedence
        // over this find().
        const verifiedDestination =
          selectedCoursewareUrl ??
          (course.courseruns ?? []).find(
            (run) => run.courseware_id === readableId,
          )?.courseware_url ??
          href
        const requestBody = programReadableIds?.length
          ? programReadableIds
          : programCoursewareId
            ? [programCoursewareId]
            : []
        if (!(await ensureCompliance())) return
        createVerifiedProgramEnrollment.mutate(
          { courserun_id: readableId, request_body: requestBody },
          {
            onSuccess: () => {
              goToCourseware(verifiedDestination ?? href, startDate, isStaff)
            },
          },
        )
      } else {
        const enrollmentAction = getCourseEnrollmentAction(course)

        if (enrollmentAction.type === "audit") {
          if (!(await ensureCompliance())) return
          createEnrollment.mutate(
            { run_id: enrollmentAction.run.id },
            {
              onSuccess: () => {
                trackCourseEnrolled(course.title)
                const destination =
                  selectedCoursewareUrl ??
                  enrollmentAction.run.courseware_url ??
                  href
                if (destination) {
                  goToCourseware(
                    destination,
                    enrollmentAction.run.start_date,
                    isStaff,
                  )
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
          goToCourseware(run.courseware_url!, run.start_date, isStaff)
        }
        NiceModal.show(CourseEnrollmentDialog, { course, onCourseEnroll })
      }
    },
    [
      ensureCompliance,
      createB2bEnrollment,
      createEnrollment,
      createVerifiedProgramEnrollment,
      replaceBasketItem,
      isStaff,
    ],
  )

  return {
    enroll,
    isPending:
      createB2bEnrollment.isPending ||
      createEnrollment.isPending ||
      createVerifiedProgramEnrollment.isPending ||
      replaceBasketItem.isPending,
  }
}
