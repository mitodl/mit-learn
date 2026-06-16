import { useReplaceBasketItem } from "@/common/mitxonline/useReplaceBasketItem"
import {
  CourseRunV2,
  CourseWithCourseRunsSerializerV2,
} from "@mitodl/mitxonline-api-axios/v2"
import { useQuery } from "@tanstack/react-query"
import {
  useCreateB2bEnrollment,
  useCreateEnrollment,
  useCreateVerifiedProgramEnrollment,
} from "api/mitxonline-hooks/enrollment"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import React from "react"
import { JustInTimeDialog } from "../DashboardDialogs"
import NiceModal from "@ebay/nice-modal-react"
import { getCourseEnrollmentAction } from "@/common/mitxonline"
import CourseEnrollmentDialog from "@/page-components/EnrollmentDialogs/CourseEnrollmentDialog"
import { trackCourseEnrolled } from "@/common/analytics/gtm"

export const useEnrollmentHandler = () => {
  const mitxOnlineUser = useQuery(mitxUserQueries.me())
  const createB2bEnrollment = useCreateB2bEnrollment()
  const createEnrollment = useCreateEnrollment()
  const createVerifiedProgramEnrollment = useCreateVerifiedProgramEnrollment()
  const replaceBasketItem = useReplaceBasketItem()

  const enroll = React.useCallback(
    ({
      course,
      readableId,
      href,
      selectedCoursewareUrl,
      isB2B,
      isVerifiedProgram,
      programCoursewareId,
      programReadableIds,
      b2bProgramId,
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
            programId: b2bProgramId,
          })
        } else {
          createB2bEnrollment.mutate(
            {
              readable_id: readableId,
              B2BEnrollRequestRequest: b2bProgramId
                ? { program_id: b2bProgramId }
                : undefined,
            },
            {
              onSuccess: () => {
                window.location.href = destinationUrl
              },
            },
          )
        }
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
        createVerifiedProgramEnrollment.mutate(
          { courserun_id: readableId, request_body: requestBody },
          {
            onSuccess: () => {
              window.location.href = verifiedDestination ?? href
            },
          },
        )
      } else {
        const enrollmentAction = getCourseEnrollmentAction(course)

        if (enrollmentAction.type === "audit") {
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
