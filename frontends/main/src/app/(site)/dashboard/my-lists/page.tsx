import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import UserListListingComponent from "@/page-components/UserListListing/UserListListing"

const Page: React.FC<AppPageProps<"/dashboard/my-lists">> = () => {
  return <UserListListingComponent title="My Lists" />
}

export default Page
