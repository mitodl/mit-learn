import React, { useCallback, useMemo, useState } from "react"
import { LearningResourceCard } from "ol-components"
import NiceModal from "@ebay/nice-modal-react"
import type { LearningResourceCardProps } from "ol-components"
import { useFeatureFlagEnabled } from "posthog-js/react"
import {
  RiBookmarkFill,
  RiBookmarkLine,
  RiListCheck3,
  RiMenuAddLine,
} from "@remixicon/react"
import { FeatureFlags } from "@/common/feature_flags"
import {
  ResourceCardSkeleton,
  ResourceCardView,
} from "../ResourceCardView/ResourceCardView"
import type {
  CardAction,
  CardLayoutProps,
  HeadingLevel,
  ResourceCardSize,
} from "../ResourceCardView/ResourceCardView"
import { learningResourceCardContent } from "./learningResourceCardContent"
import {
  AddToLearningPathDialog,
  AddToUserListDialog,
} from "../Dialogs/AddToListDialog"
import { resourceDrawerPushUrl } from "../LearningResourceDrawer/resourceDrawerPushUrl"
import { useUserMe } from "api/hooks/user"
import { LearningResource } from "api"
import { SignupPopover } from "../SignupPopover/SignupPopover"
import { useIsUserListMember } from "api/hooks/userLists"
import { useLearningResourceDetailSetCache } from "api/hooks/learningResources"
import { useIsLearningPathMember } from "api/hooks/learningPaths"

export const useResourceCard = (resource?: LearningResource | null) => {
  const { data: user } = useUserMe()
  const { data: inUserList } = useIsUserListMember(resource?.id)
  const { data: inLearningPath } = useIsLearningPathMember(resource?.id)

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

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

  const onClick = useLearningResourceDetailSetCache(resource)

  return {
    onClick,
    anchorEl,
    handleClosePopover,
    handleAddToLearningPathClick,
    handleAddToUserListClick,
    inUserList,
    inLearningPath,
  }
}

type HeadingElement = "h1" | "h2" | "h3" | "h4" | "h5" | "h6"

const subheadingMap: Record<HeadingElement, HeadingLevel> = {
  h1: 2,
  h2: 3,
  h3: 4,
  h4: 5,
  h5: 6,
  h6: 6,
}

type ResourceIdCallback = NonNullable<
  LearningResourceCardProps["onAddToUserListClick"]
>

type ResourceCardV2Props = {
  resource?: LearningResource | null
  isLoading?: boolean
  list?: boolean
  size?: ResourceCardSize
  className?: string
  headingLevel: HeadingLevel
  onLinkClick?: () => void
  onAddToLearningPathClick: ResourceIdCallback | null
  onAddToUserListClick: ResourceIdCallback | null
  inUserList?: boolean
  inLearningPath?: boolean
}

const ResourceCardV2: React.FC<ResourceCardV2Props> = ({
  resource,
  isLoading,
  list,
  size,
  className,
  headingLevel,
  onLinkClick,
  onAddToLearningPathClick,
  onAddToUserListClick,
  inUserList,
  inLearningPath,
}) => {
  const layout: CardLayoutProps = list
    ? { layout: "responsive" }
    : { layout: "vertical", size }

  if (isLoading) {
    return <ResourceCardSkeleton className={className} {...layout} />
  }
  if (!resource) {
    return null
  }

  const actions: CardAction[] = []
  if (onAddToLearningPathClick) {
    actions.push({
      label: inLearningPath
        ? `In Learning Path: ${resource.title}`
        : `Add to Learning Path: ${resource.title}`,
      filled: !!inLearningPath,
      icon: inLearningPath ? (
        <RiListCheck3 aria-hidden />
      ) : (
        <RiMenuAddLine aria-hidden />
      ),
      onClick: (event) => onAddToLearningPathClick(event, resource.id),
    })
  }
  if (onAddToUserListClick) {
    actions.push({
      label: inUserList
        ? `Bookmarked: ${resource.title}`
        : `Bookmark: ${resource.title}`,
      filled: !!inUserList,
      icon: inUserList ? (
        <RiBookmarkFill aria-hidden />
      ) : (
        <RiBookmarkLine aria-hidden />
      ),
      onClick: (event) => onAddToUserListClick(event, resource.id),
    })
  }

  return (
    <ResourceCardView
      {...learningResourceCardContent(resource)}
      {...layout}
      href={resource.learn_url}
      pushUrl={() => resourceDrawerPushUrl(resource)}
      onLinkClick={onLinkClick}
      actions={actions}
      headingLevel={headingLevel}
      className={className}
    />
  )
}

type ResourceCardProps = Omit<
  LearningResourceCardProps,
  | "href"
  | "pushUrl"
  | "onAddToLearningPathClick"
  | "onAddToUserListClick"
  | "inUserList"
  | "inLearningPath"
  | "onClick"
> & {
  headingLevel?: HeadingLevel
  parentHeadingEl?: HeadingElement
  onCardClick?: () => void
}

/**
 * Just like `ol-components/LearningResourceCard`, or the redesigned
 * `ResourceCardView` when the `resource-card-redesign` flag is on, but with
 * builtin actions:
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
    anchorEl,
    handleClosePopover,
    handleAddToLearningPathClick,
    handleAddToUserListClick,
    inUserList,
    inLearningPath,
    onClick,
  } = useResourceCard(resource)
  const redesign =
    useFeatureFlagEnabled(FeatureFlags.ResourceCardRedesign) === true

  const composedOnClick = onCardClick
    ? () => {
        onClick?.()
        onCardClick()
      }
    : onClick

  const headingLevel = parentHeadingEl ? subheadingMap[parentHeadingEl] : 6

  if (redesign) {
    return (
      <>
        <ResourceCardV2
          resource={resource}
          isLoading={others.isLoading}
          list={others.list}
          size={others.size}
          className={others.className}
          headingLevel={others.headingLevel ?? headingLevel}
          onLinkClick={composedOnClick}
          onAddToLearningPathClick={handleAddToLearningPathClick}
          onAddToUserListClick={handleAddToUserListClick}
          inUserList={inUserList}
          inLearningPath={inLearningPath}
        />
        <SignupPopover anchorEl={anchorEl} onClose={handleClosePopover} />
      </>
    )
  }

  return (
    <>
      <LearningResourceCard
        onClick={composedOnClick}
        resource={resource}
        /**
         * The resource's own page where it has one, else its drawer. Crawlers
         * follow this, so pointing it at the dedicated page is what stops the
         * drawer competing with that page for the same content. `pushUrl` below
         * is unaffected: a click still opens the drawer in place.
         */
        href={resource?.learn_url}
        pushUrl={resource ? () => resourceDrawerPushUrl(resource) : undefined}
        onAddToLearningPathClick={handleAddToLearningPathClick}
        onAddToUserListClick={handleAddToUserListClick}
        inUserList={inUserList}
        inLearningPath={inLearningPath}
        headingLevel={headingLevel}
        {...others}
      />
      <SignupPopover anchorEl={anchorEl} onClose={handleClosePopover} />
    </>
  )
}

export { ResourceCard }
export type { ResourceCardProps }
