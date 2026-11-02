import React from "react"
import { LearningResourceListCardCondensed } from "ol-components"
import type { LearningResource } from "api"
import { resourceDrawerPushUrl } from "../LearningResourceDrawer/resourceDrawerPushUrl"
import { SignupPopover } from "../SignupPopover/SignupPopover"
import { useResourceCard } from "./ResourceCard"

type CondensedResourceCardProps = {
  resource: LearningResource
}

/**
 * The condensed list card with the same builtin actions as `ResourceCard`:
 * click opens the Resource Drawer, and the add-to-list buttons open their
 * dialogs (or the signup popover when unauthenticated).
 */
const CondensedResourceCard: React.FC<CondensedResourceCardProps> = ({
  resource,
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

  return (
    <>
      <LearningResourceListCardCondensed
        resource={resource}
        onClick={onClick}
        href={resource.learn_url}
        pushUrl={() => resourceDrawerPushUrl(resource)}
        onAddToLearningPathClick={handleAddToLearningPathClick}
        onAddToUserListClick={handleAddToUserListClick}
        inUserList={inUserList}
        inLearningPath={inLearningPath}
      />
      <SignupPopover anchorEl={anchorEl} onClose={handleClosePopover} />
    </>
  )
}

export { CondensedResourceCard }
export type { CondensedResourceCardProps }
