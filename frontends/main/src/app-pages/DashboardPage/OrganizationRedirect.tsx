"use client"

import React, { useEffect } from "react"
import { useRouter } from "next-nprogress-bar"
import { useQuery } from "@tanstack/react-query"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { Skeleton } from "ol-components"

const OrganizationRedirect: React.FC = () => {
  const router = useRouter()

  const { isLoading: isLoadingMitxOnlineUser, data: mitxOnlineUser } = useQuery(
    mitxUserQueries.me(),
  )

  useEffect(() => {
    if (!isLoadingMitxOnlineUser) {
      if (mitxOnlineUser) {
        const b2bOrganization = mitxOnlineUser.b2b_organizations[0]
        if (b2bOrganization) {
          const lastVisited = localStorage.getItem("last-dashboard-org")
          if (lastVisited) {
            router.replace(`/dashboard/organization/${lastVisited}`)
          } else {
            router.replace(
              `/dashboard/organization/${b2bOrganization.slug.replace("org-", "")}`,
            )
          }
        } else {
          router.replace("/dashboard")
        }
      } else {
        router.replace("/dashboard")
      }
    }
  }, [isLoadingMitxOnlineUser, mitxOnlineUser, router])

  if (isLoadingMitxOnlineUser) {
    return (
      <Skeleton width="100%" height="100px" style={{ marginBottom: "16px" }} />
    )
  }

  return null
}

export default OrganizationRedirect
