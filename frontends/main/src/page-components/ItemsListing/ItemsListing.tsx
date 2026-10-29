import React, { useCallback, useEffect } from "react"
import type { LearningResource } from "api"
import {
  SortableItem,
  SortableList,
  RenderActive,
  arrayMove,
  OnSortEnd,
  LoadingSpinner,
  styled,
  PlainList,
  LearningResourceListCardCondensed,
} from "ol-components"
import { CondensedResourceCard } from "@/page-components/ResourceCard/CondensedResourceCard"
import { useLearningPathListItemMove } from "api/hooks/learningPaths"
import { useUserListListItemMove } from "api/hooks/userLists"
import { ListType } from "api/constants"

const EmptyMessage = styled.p({
  fontStyle: "italic",
})

const Loading = styled.div({
  marginTop: "150px",
})

const StyledPlainList = styled(PlainList)({
  marginTop: "8px",
})

type LearningResourceListItem = {
  id: number
  resource: LearningResource
  position?: number
  parent: number
  child: number
}

type ItemsListingProps = {
  listType: string
  items?: LearningResourceListItem[]
  isLoading?: boolean
  isRefetching?: boolean
  emptyMessage: string
  sortable?: boolean
}

const ItemsListingSortable: React.FC<{
  listType: NonNullable<ItemsListingProps["listType"]>
  items: NonNullable<ItemsListingProps["items"]>
  isRefetching?: boolean
}> = ({ listType, items, isRefetching }) => {
  const moveLearningPathListItem = useLearningPathListItemMove()
  const moveUserListListItem = useUserListListItemMove()

  const [sorted, setSorted] = React.useState<LearningResourceListItem[]>([])

  /**
   * `sorted` is a local copy of `items`:
   *  - `onSortEnd`, we'll update `sorted` copy immediately to prevent UI from
   *  snapping back to its original position.
   *  - `items` is the source of truth (most likely, this is coming from an API)
   *    so sync `items` -> `sorted` when `items` changes.
   */
  useEffect(() => setSorted(items), [items])

  const renderDragging: RenderActive = useCallback((active) => {
    const item = active.data.current as LearningResourceListItem
    return (
      <LearningResourceListCardCondensed resource={item.resource} draggable />
    )
  }, [])

  const onSortEnd: OnSortEnd<number> = useCallback(
    async (e) => {
      const active = e.active.data
        .current as unknown as LearningResourceListItem
      const over = e.over.data.current as unknown as LearningResourceListItem
      setSorted((current) => {
        const newOrder = arrayMove(current, e.activeIndex, e.overIndex)
        return newOrder
      })
      if (listType === ListType.LearningPath) {
        moveLearningPathListItem.mutate({
          id: active.id,
          parent: active.parent,
          position: over.position,
        })
      }
      if (listType === ListType.UserList) {
        moveUserListListItem.mutate({
          id: active.id,
          parent: active.parent,
          position: over.position,
        })
      }
    },
    [listType, moveLearningPathListItem, moveUserListListItem],
  )

  const disabled =
    isRefetching ||
    moveLearningPathListItem.isPending ||
    moveUserListListItem.isPending

  return (
    <StyledPlainList disabled={disabled} itemSpacing={1}>
      <SortableList
        itemIds={sorted.map((item) => item.id)}
        onSortEnd={onSortEnd}
        renderActive={renderDragging}
      >
        {sorted.map((item) => {
          return (
            <SortableItem
              Component="li"
              key={item.id}
              id={item.id}
              data={item}
              disabled={disabled}
            >
              {(handleProps) => (
                <div {...handleProps}>
                  <LearningResourceListCardCondensed
                    resource={item.resource}
                    draggable
                  />
                </div>
              )}
            </SortableItem>
          )
        })}
      </SortableList>
    </StyledPlainList>
  )
}

const ItemsListing: React.FC<ItemsListingProps> = ({
  listType,
  items = [],
  isLoading,
  isRefetching,
  emptyMessage,
  sortable = false,
}) => {
  return (
    <>
      {isLoading ? (
        <Loading>
          <LoadingSpinner loading />
        </Loading>
      ) : items.length === 0 ? (
        <EmptyMessage>{emptyMessage}</EmptyMessage>
      ) : sortable ? (
        <ItemsListingSortable
          listType={listType}
          items={items}
          isRefetching={isRefetching}
        />
      ) : (
        <StyledPlainList itemSpacing={1}>
          {items.map((item) => (
            <li key={item.id}>
              <CondensedResourceCard resource={item.resource} />
            </li>
          ))}
        </StyledPlainList>
      )}
    </>
  )
}

export default ItemsListing
export type { ItemsListingProps, LearningResourceListItem }
