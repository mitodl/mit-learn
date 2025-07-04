import React, { Suspense, useEffect, useId, useMemo } from "react"
import { RoutedDrawer, imgConfigs } from "ol-components"
import { LearningResourceExpanded } from "../LearningResourceExpanded/LearningResourceExpanded"
import type {
  LearningResourceCardProps,
  RoutedDrawerProps,
} from "ol-components"
import { useLearningResourcesDetail } from "api/hooks/learningResources"

import {
  canonicalResourceDrawerUrl,
  RESOURCE_DRAWER_PARAMS,
} from "@/common/urls"
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
import { PostHogEvents } from "@/common/constants"

const REQUIRED_PARAMS = [RESOURCE_DRAWER_PARAMS.resource] as const
const ALL_PARAMS = [
  RESOURCE_DRAWER_PARAMS.resource,
  RESOURCE_DRAWER_PARAMS.syllabus,
] as const

const useCapturePageView = (resourceId: number) => {
  const { data, isSuccess } = useLearningResourcesDetail(Number(resourceId))
  const posthog = usePostHog()
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_API_KEY

  useEffect(() => {
    if (!apiKey || apiKey.length < 1) return
    if (!isSuccess) return
    posthog.capture(PostHogEvents.LearningResourceDrawerView, {
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

const DrawerContent: React.FC<{
  resourceId: number
  titleId: string
  closeDrawer: () => void
  chatExpanded: boolean
}> = ({ resourceId, closeDrawer, titleId, chatExpanded }) => {
  /**
   * Ideally the resource data should already exist in the query cache, e.g., by:
   * - a server-side prefetch
   * - or by `setQueryData` in the component that triggers opening this drawer.
   *   The triggering component likely has the data already via some other API
   *   call.
   */
  const posthog = usePostHog()
  const resource = useLearningResourcesDetail(Number(resourceId))
  if (process.env.NEXT_PUBLIC_POSTHOG_API_KEY) {
    posthog.capture(PostHogEvents.LearningResourceDrawerOpen, {
      resource: resource?.data,
    })
  }
  const [signupEl, setSignupEl] = React.useState<HTMLElement | null>(null)
  const { data: user } = useUserMe()
  const { data: inLearningPath } = useIsLearningPathMember(resourceId)
  const { data: inUserList } = useIsUserListMember(resourceId)
  const carouselResultsLimit = 12

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
  const itemsCarousel = (
    title: string,
    learningResourceId: number,
    excludeResourceId: number,
  ) => {
    return (
      <ResourceCarousel
        titleComponent="p"
        titleVariant="subtitle1"
        title={title}
        config={[
          {
            label: title,
            cardProps: { size: "small" },
            data: {
              type: "resource_items",
              params: {
                learning_resource_id: learningResourceId,
                limit: carouselResultsLimit,
              },
            },
          },
        ]}
        excludeResourceId={excludeResourceId}
      />
    )
  }
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
            params: { id: resourceId, limit: carouselResultsLimit },
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
  const topCarousels = []
  if (resource.data?.resource_type === ResourceTypeEnum.Program) {
    topCarousels.push(
      itemsCarousel("Courses in this Program", resourceId, resourceId),
    )
  }
  const bottomCarousels = []
  if (
    resource.data?.resource_type === ResourceTypeEnum.Video &&
    resource.data?.playlists?.length > 0
  ) {
    bottomCarousels.push(
      itemsCarousel(
        "Other Videos in this Series",
        parseInt(resource.data.playlists[0]),
        resourceId,
      ),
    )
  }
  if (resource.data?.resource_type === ResourceTypeEnum.VideoPlaylist) {
    bottomCarousels.push(
      itemsCarousel("Videos in this Series", resourceId, resourceId),
    )
  }
  if (
    resource.data?.resource_type === ResourceTypeEnum.PodcastEpisode &&
    resource.data?.podcast_episode?.podcasts?.length > 0
  ) {
    bottomCarousels.push(
      itemsCarousel(
        "Other Episodes in this Podcast",
        parseInt(resource.data.podcast_episode.podcasts[0]),
        resourceId,
      ),
    )
  }
  if (resource.data?.resource_type === ResourceTypeEnum.Podcast) {
    bottomCarousels.push(
      itemsCarousel("Recent Episodes", resourceId, resourceId),
    )
  }
  bottomCarousels.push(similarResourcesCarousel)
  bottomCarousels.push(...(topicCarousels || []))

  return (
    <>
      <LearningResourceExpanded
        titleId={titleId}
        imgConfig={imgConfigs.large}
        resourceId={resourceId}
        resource={resource.data}
        topCarousels={topCarousels}
        bottomCarousels={bottomCarousels}
        chatExpanded={chatExpanded}
        user={user}
        shareUrl={canonicalResourceDrawerUrl(resourceId)}
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
    overflowX: "hidden",
    maxWidth: (theme) => ({
      [theme.breakpoints.up("md")]: {
        maxWidth: theme.breakpoints.values.md,
      },
      [theme.breakpoints.down("sm")]: {
        maxWidth: "100%",
      },
    }),
    minWidth: (theme) => ({
      minWidth: theme.breakpoints.values.md,
      [theme.breakpoints.down("md")]: {
        maxWidth: "100%",
        minWidth: "100%",
      },
    }),
  },
}

const LearningResourceDrawer = () => {
  const id = useId()
  return (
    <Suspense>
      <RoutedDrawer
        anchor="right"
        requiredParams={REQUIRED_PARAMS}
        params={ALL_PARAMS}
        PaperProps={PAPER_PROPS}
        hideCloseButton={true}
        aria-labelledby={id}
      >
        {({ params, closeDrawer }) => {
          return (
            <DrawerContent
              chatExpanded={params[RESOURCE_DRAWER_PARAMS.syllabus] !== null}
              titleId={id}
              resourceId={Number(params[RESOURCE_DRAWER_PARAMS.resource])}
              closeDrawer={closeDrawer}
            />
          )
        }}
      </RoutedDrawer>
    </Suspense>
  )
}

export default LearningResourceDrawer
