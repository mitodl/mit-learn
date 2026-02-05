"use client"

import React, { use, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { matchOrganizationBySlug } from "@/common/utils"
import { useRouter } from "next-nprogress-bar"
import { contractView, DASHBOARD_HOME } from "@/common/urls"

const Page: React.FC<{
  params: Promise<{ orgSlug: string }>
}> = ({ params }) => {
  const router = useRouter()
  const { isLoading: isLoadingMitxOnlineUser, data: mitxOnlineUser } = useQuery(
    mitxUserQueries.me(),
  )

  const resolved = use(params)
  const orgSlug = resolved.orgSlug

  const b2bOrganization = mitxOnlineUser?.b2b_organizations.find(
    matchOrganizationBySlug(orgSlug),
  )
  const firstContractSlug = b2bOrganization?.contracts[0]?.slug

  useEffect(() => {
    if (!isLoadingMitxOnlineUser) {
      if (firstContractSlug) {
        router.replace(contractView(orgSlug, firstContractSlug))
      } else {
        router.replace(DASHBOARD_HOME)
      }
    }
  }, [isLoadingMitxOnlineUser, firstContractSlug, orgSlug, router])

  return null
}

export default Page
