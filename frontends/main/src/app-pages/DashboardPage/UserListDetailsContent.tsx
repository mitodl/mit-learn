"use client"
import React, { useMemo } from "react"
import {
  useInfiniteUserListItems,
  useUserListsDetail,
} from "api/hooks/userLists"
import { useRouter } from "next-nprogress-bar"
import { ListType } from "api/constants"
import { useUserMe } from "api/hooks/user"
import { manageListDialogs } from "@/page-components/ManageListDialogs/ManageListDialogs"
import ItemsListingComponent from "@/page-components/ItemsListing/ItemsListingComponent"

interface UserListDetailsContentProps {
  userListId: number
}

const UserListDetailsContent: React.FC<UserListDetailsContentProps> = (
  props,
) => {
  const { userListId } = props

  const { data: user } = useUserMe()
  const listQuery = useUserListsDetail(userListId)
  const itemsQuery = useInfiniteUserListItems({ userlist_id: userListId })
  const router = useRouter()

  const items = useMemo(() => {
    const pages = itemsQuery.data?.pages
    return pages?.flatMap((p) => p.results ?? []) ?? []
  }, [itemsQuery.data])

  const onDestroyUserList = () => {
    router.push("/dashboard/my-lists")
  }

  return (
    <ItemsListingComponent
      listType={ListType.UserList}
      list={listQuery.data}
      items={items}
      isLoading={itemsQuery.isLoading}
      isFetching={itemsQuery.isFetching}
      showSort={!!user?.is_authenticated}
      canEdit={!!user?.is_authenticated}
      handleEdit={() =>
        manageListDialogs.upsertUserList(listQuery.data, onDestroyUserList)
      }
      condensed
    />
  )
}

export { UserListDetailsContent }
