import React, { Suspense, useEffect, useId, useMemo } from "react"
import {
  RoutedDrawer,
  LearningResourceExpandedV2,
  imgConfigs,
} from "ol-components"
import type {
  LearningResourceCardProps,
  RoutedDrawerProps,
} from "ol-components"
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
import ResourceCarousel from "../ResourceCarousel/ResourceCarousel"
import { useIsLearningPathMember } from "api/hooks/learningPaths"
import { useIsUserListMember } from "api/hooks/userLists"
import { TopicCarouselConfig } from "@/common/carousels"
import { ResourceTypeEnum } from "api"

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
  titleId: string
  closeDrawer: () => void
}> = ({ resourceId, closeDrawer, titleId }) => {
  /**
   * Ideally the resource data should already exist in the query cache, e.g., by:
   * - a server-side prefetch
   * - or by `setQueryData` in the component that triggers opening this drawer.
   *   The triggering component likely has the data already via some other API
   *   call.
   */
  const resource = useLearningResourcesDetail(Number(resourceId))
  const [signupEl, setSignupEl] = React.useState<HTMLElement | null>(null)
  const { data: user } = useUserMe()
  const { data: inLearningPath } = useIsLearningPathMember(resourceId)
  const { data: inUserList } = useIsUserListMember(resourceId)
  const limit = 12

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
  const coursesInProgramCarousel =
    resource.data?.resource_type === ResourceTypeEnum.Program ? (
      <ResourceCarousel
        titleComponent="p"
        titleVariant="subtitle1"
        title="Courses in this Program"
        config={[
          {
            label: "Courses in this Program",
            cardProps: { size: "small" },
            data: {
              type: "resource_items",
              params: { learning_resource_id: resourceId, limit: limit },
            },
          },
        ]}
      />
    ) : null
  const topCarousels = coursesInProgramCarousel
    ? [coursesInProgramCarousel]
    : undefined
  const otherVideosInThisSeries =
    resource.data?.resource_type === ResourceTypeEnum.Video ? (
      resource.data?.playlists.length > 0 ? (
        <ResourceCarousel
          titleComponent="p"
          titleVariant="subtitle1"
          title="Other Videos in this Series"
          config={[
            {
              label: "Other Videos in this Series",
              cardProps: { size: "small" },
              data: {
                type: "resource_items",
                params: {
                  learning_resource_id: parseInt(resource.data.playlists[0]),
                  limit: limit,
                },
              },
            },
          ]}
        />
      ) : null
    ) : null
  const videosInThisPlaylist =
    resource.data?.resource_type === ResourceTypeEnum.VideoPlaylist ? (
      <ResourceCarousel
        titleComponent="p"
        titleVariant="subtitle1"
        title="Videos in this Series"
        config={[
          {
            label: "Videos in this Series",
            cardProps: { size: "small" },
            data: {
              type: "resource_items",
              params: { learning_resource_id: resourceId, limit: limit },
            },
          },
        ]}
      />
    ) : null
  const similarResourcesCarousel = (
    <ResourceCarousel
      titleComponent="p"
      titleVariant="subtitle1"
      title="Similar Learning Resources"
      config={[
        {
          label: "Similar Learning Resources",
          cardProps: { size: "small" },
          data: {
            type: "lr_vector_similar",
            params: { id: resourceId, limit: limit },
          },
        },
      ]}
      excludeResourceId={resourceId}
    />
  )
  const topics = resource.data?.topics
    ?.filter((topic) => topic.parent)
    .slice(0, 2)
  const topicCarousels = topics?.map((topic) => (
    <ResourceCarousel
      key={topic.id}
      titleComponent="p"
      titleVariant="subtitle1"
      title={`Learning Resources in "${topic.name}"`}
      config={TopicCarouselConfig(topic.name)}
      data-testid={`topic-carousel-${topic}`}
      excludeResourceId={resourceId}
    />
  ))
  const bottomCarousels = []
  if (otherVideosInThisSeries) {
    bottomCarousels.push(otherVideosInThisSeries)
  }
  if (videosInThisPlaylist) {
    bottomCarousels.push(videosInThisPlaylist)
  }
  bottomCarousels.push(similarResourcesCarousel)
  bottomCarousels.push(...(topicCarousels || []))

  return (
    <>
      <LearningResourceExpandedV2
        titleId={titleId}
        imgConfig={imgConfigs.large}
        resourceId={resourceId}
        resource={resource.data}
        topCarousels={topCarousels}
        bottomCarousels={bottomCarousels}
        user={user}
        shareUrl={`${window.location.origin}/search?${RESOURCE_DRAWER_QUERY_PARAM}=${resourceId}`}
        inLearningPath={inLearningPath}
        inUserList={inUserList}
        onAddToLearningPathClick={handleAddToLearningPathClick}
        onAddToUserListClick={handleAddToUserListClick}
        closeDrawer={closeDrawer}
      />
      <SignupPopover anchorEl={signupEl} onClose={() => setSignupEl(null)} />
    </>
  )
}

const PAPER_PROPS: RoutedDrawerProps["PaperProps"] = {
  sx: {
    maxWidth: (theme) => ({
      [theme.breakpoints.up("md")]: {
        maxWidth: theme.breakpoints.values.md,
      },
      [theme.breakpoints.down("sm")]: {
        maxWidth: "100%",
      },
    }),
    minWidth: (theme) => ({
      [theme.breakpoints.down("md")]: {
        maxWidth: "100%",
      },
    }),
  },
}

const LearningResourceDrawerV2 = () => {
  const id = useId()
  return (
    <Suspense>
      <RoutedDrawer
        anchor="right"
        requiredParams={RESOURCE_DRAWER_PARAMS}
        PaperProps={PAPER_PROPS}
        hideCloseButton={true}
        aria-labelledby={id}
      >
        {({ params, closeDrawer }) => {
          return (
            <DrawerContent
              titleId={id}
              resourceId={Number(params.resource)}
              closeDrawer={closeDrawer}
            />
          )
        }}
      </RoutedDrawer>
    </Suspense>
  )
}

export default LearningResourceDrawerV2
