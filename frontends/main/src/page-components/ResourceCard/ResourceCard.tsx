import React, { useCallback, useMemo, useState } from "react"
import { LearningResourceCard } from "ol-components"
import NiceModal from "@ebay/nice-modal-react"
import type { LearningResourceCardProps } from "ol-components"
import {
  AddToLearningPathDialog,
  AddToUserListDialog,
} from "../Dialogs/AddToListDialog"
import { useResourceDrawerHref } from "../LearningResourceDrawer/useResourceDrawerHref"
import { useUserMe } from "api/hooks/user"
import { LearningResource, PodcastEpisodeResource, ResourceTypeEnum } from "api"
import { SignupPopover } from "../SignupPopover/SignupPopover"
import { useIsUserListMember } from "api/hooks/userLists"
import { useLearningResourceDetailSetCache } from "api/hooks/learningResources"
import { useIsLearningPathMember } from "api/hooks/learningPaths"
import ShareDialog from "@/app-pages/VideoPlaylistCollectionPage/ShareDialog"
import { env } from "@/env"
import { podcastEpisodePageView } from "@/common/urls"

const NEXT_PUBLIC_ORIGIN = env("NEXT_PUBLIC_ORIGIN")

export const useResourceCard = (resource?: LearningResource | null) => {
  const getDrawerHref = useResourceDrawerHref()
  const { data: user } = useUserMe()
  const { data: inUserList } = useIsUserListMember(resource?.id)
  const { data: inLearningPath } = useIsLearningPathMember(resource?.id)

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [shareAnchorEl, setShareAnchorEl] = useState<HTMLElement | null>(null)

  const handleClosePopover = useCallback(() => {
    setAnchorEl(null)
  }, [])

  const handleAddToLearningPathClick: LearningResourceCardProps["onAddToLearningPathClick"] =
    useMemo(() => {
      if (user?.is_authenticated && user?.is_learning_path_editor) {
        return (event, resourceId: number) => {
          NiceModal.show(AddToLearningPathDialog, { resourceId })
        }
      }
      return null
    }, [user])

  const handleAddToUserListClick: LearningResourceCardProps["onAddToUserListClick"] =
    useMemo(() => {
      if (!user) {
        return null
      }
      if (user.is_authenticated) {
        return (event, resourceId: number) => {
          NiceModal.show(AddToUserListDialog, { resourceId })
        }
      }
      return (event) => {
        setAnchorEl(event.currentTarget)
      }
    }, [user])

  const handleShareClick: LearningResourceCardProps["onShareClick"] =
    useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
      setShareAnchorEl(event.currentTarget)
    }, [])

  const onClick = useLearningResourceDetailSetCache(resource)

  return {
    onClick,
    getDrawerHref,
    anchorEl,
    handleClosePopover,
    handleAddToLearningPathClick,
    handleAddToUserListClick,
    handleShareClick,
    shareAnchorEl,
    setShareAnchorEl,
    inUserList,
    inLearningPath,
  }
}

type HeadingElement = "h1" | "h2" | "h3" | "h4" | "h5" | "h6"

const subheadingMap: Record<HeadingElement, number> = {
  h1: 2,
  h2: 3,
  h3: 4,
  h4: 5,
  h5: 6,
  h6: 6,
}

type ResourceCardProps = Omit<
  LearningResourceCardProps,
  "href" | "onAddToLearningPathClick" | "onAddToUserListClick" | "onShareClick"
> & {
  headingLevel?: number
  parentHeadingEl?: HeadingElement
  onCardClick?: () => void
}

/**
 * Just like `ol-components/LearningResourceCard`, but with builtin actions:
 *  - click opens the Resource Drawer
 *  - onAddToListClick opens the Add to List modal
 *    - for unauthenticated users, a popover prompts signup instead.
 *  - onAddToLearningPathClick opens the Add to Learning Path modal
 */
const ResourceCard: React.FC<ResourceCardProps> = ({
  resource,
  parentHeadingEl,
  onCardClick,
  ...others
}) => {
  const {
    getDrawerHref,
    anchorEl,
    handleClosePopover,
    handleAddToLearningPathClick,
    handleAddToUserListClick,
    handleShareClick,
    shareAnchorEl,
    setShareAnchorEl,
    inUserList,
    inLearningPath,
    onClick,
  } = useResourceCard(resource)

  const composedOnClick = onCardClick
    ? () => {
        onClick?.()
        onCardClick()
      }
    : onClick

  const headingLevel = parentHeadingEl ? subheadingMap[parentHeadingEl] : 6

  const isPodcastEpisode =
    resource?.resource_type === ResourceTypeEnum.PodcastEpisode
  const podcastId = isPodcastEpisode
    ? resource?.podcast_episode?.podcasts?.[0]
    : undefined
  const sharePageUrl =
    isPodcastEpisode && podcastId !== undefined
      ? `${NEXT_PUBLIC_ORIGIN}${podcastEpisodePageView(String(resource!.id), String(podcastId), resource?.title)}`
      : ""

  return (
    <>
      <LearningResourceCard
        onClick={composedOnClick}
        resource={resource}
        href={resource ? getDrawerHref(resource.id) : undefined}
        onAddToLearningPathClick={handleAddToLearningPathClick}
        onAddToUserListClick={handleAddToUserListClick}
        onShareClick={
          isPodcastEpisode && podcastId !== undefined ? handleShareClick : null
        }
        inUserList={inUserList}
        inLearningPath={inLearningPath}
        headingLevel={headingLevel}
        {...others}
      />
      <SignupPopover anchorEl={anchorEl} onClose={handleClosePopover} />
      {isPodcastEpisode && podcastId !== undefined && (
        <ShareDialog
          open={Boolean(shareAnchorEl)}
          onClose={() => setShareAnchorEl(null)}
          resource={resource as PodcastEpisodeResource}
          pageUrl={sharePageUrl}
          title={resource?.title ?? ""}
        />
      )}
    </>
  )
}

export { ResourceCard }
export type { ResourceCardProps }
