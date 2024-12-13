import React, { Suspense, useEffect, useMemo } from "react"
import { RoutedDrawer } from "ol-components/RoutedDrawer/RoutedDrawer"
import { LearningResourceExpandedV1 } from "ol-components/LearningResourceExpanded/LearningResourceExpandedV1"
import { imgConfigs } from "ol-components/constants/imgConfigs"
import type { LearningResourceCardProps } from "ol-components/LearningResourceCard/LearningResourceCard"
import type { RoutedDrawerProps } from "ol-components/RoutedDrawer/RoutedDrawer"
import { useLearningResourcesDetail } from "api/hooks/learningResources"

import { RESOURCE_DRAWER_QUERY_PARAM } from "@/common/urls"
import { useUserMe } from "api/hooks/user"
import NiceModal from "@ebay/nice-modal-react"
import {
  AddToLearningPathDialog,
  AddToUserListDialog,
} from "../Dialogs/AddToListDialog"
import { SignupPopover } from "../SignupPopover/SignupPopover"
import { usePostHog } from "posthog-js/react"
import { useIsLearningPathMember } from "api/hooks/learningPaths"
import { useIsUserListMember } from "api/hooks/userLists"

const RESOURCE_DRAWER_PARAMS = [RESOURCE_DRAWER_QUERY_PARAM] as const

const useCapturePageView = (resourceId: number) => {
  const { data, isSuccess } = useLearningResourcesDetail(Number(resourceId))
  const posthog = usePostHog()
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_API_KEY

  useEffect(() => {
    if (!apiKey || apiKey.length < 1) return
    if (!isSuccess) return
    posthog.capture("lrd_view", {
      resourceId: data?.id,
      readableId: data?.readable_id,
      platformCode: data?.platform?.code,
      resourceType: data?.resource_type,
    })
  }, [
    isSuccess,
    posthog,
    data?.id,
    data?.readable_id,
    data?.platform?.code,
    data?.resource_type,
    apiKey,
  ])
}

/**
 * Convert HTML to plaintext, removing any HTML tags.
 * This conversion method has some issues:
 * 1. It is unsafe for untrusted HTML
 * 2. It must be run in a browser, not on a server.
 */
// eslint-disable-next-line camelcase
// const unsafe_html2plaintext = (text: string) => {
//   const div = document.createElement("div")
//   div.innerHTML = text
//   return div.textContent || div.innerText || ""
// }

const DrawerContent: React.FC<{
  resourceId: number
}> = ({ resourceId }) => {
  const resource = useLearningResourcesDetail(Number(resourceId))
  const [signupEl, setSignupEl] = React.useState<HTMLElement | null>(null)
  const { data: user } = useUserMe()
  const { data: inLearningPath } = useIsLearningPathMember(resourceId)
  const { data: inUserList } = useIsUserListMember(resourceId)

  const handleAddToLearningPathClick: LearningResourceCardProps["onAddToLearningPathClick"] =
    useMemo(() => {
      if (user?.is_learning_path_editor) {
        return (event, resourceId: number) => {
          NiceModal.show(AddToLearningPathDialog, { resourceId })
        }
      }
      return null
    }, [user])
  const handleAddToUserListClick: LearningResourceCardProps["onAddToUserListClick"] =
    useMemo(() => {
      return (event, resourceId: number) => {
        if (!user?.is_authenticated) {
          setSignupEl(event.currentTarget)
          return
        }
        NiceModal.show(AddToUserListDialog, { resourceId })
      }
    }, [user])
  useCapturePageView(Number(resourceId))

  return (
    <>
      <LearningResourceExpandedV1
        imgConfig={imgConfigs.large}
        resource={resource.data}
        user={user}
        inLearningPath={inLearningPath}
        inUserList={inUserList}
        onAddToLearningPathClick={handleAddToLearningPathClick}
        onAddToUserListClick={handleAddToUserListClick}
      />
      <SignupPopover anchorEl={signupEl} onClose={() => setSignupEl(null)} />
    </>
  )
}

const PAPER_PROPS: RoutedDrawerProps["PaperProps"] = {
  sx: {
    maxWidth: (theme) => theme.breakpoints.values.sm,
    minWidth: (theme) => ({
      [theme.breakpoints.down("sm")]: {
        minWidth: "100%",
      },
    }),
  },
}

const LearningResourceDrawerV1 = () => {
  return (
    <Suspense>
      <RoutedDrawer
        anchor="right"
        requiredParams={RESOURCE_DRAWER_PARAMS}
        PaperProps={PAPER_PROPS}
      >
        {({ params }) => {
          return <DrawerContent resourceId={Number(params.resource)} />
        }}
      </RoutedDrawer>
    </Suspense>
  )
}

export default LearningResourceDrawerV1
