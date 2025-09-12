import React from "react"
import UserListListingComponent from "@/page-components/UserListListing/UserListListing"

const Page: React.FC<PageProps<"/dashboard/my-lists">> = () => {
  return <UserListListingComponent title="My Lists" />
}

export default Page
