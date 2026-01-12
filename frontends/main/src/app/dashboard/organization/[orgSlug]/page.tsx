"use client"

import React, { use, useEffect } from "react"
import ContractContent from "@/app-pages/DashboardPage/ContractContent"
import { useQuery } from "@tanstack/react-query"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { matchOrganizationBySlug } from "@/common/utils"
import { useRouter } from "next-nprogress-bar"

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
    if (!isLoadingMitxOnlineUser && !firstContractSlug) {
      router.replace("/dashboard")
    }
  }, [isLoadingMitxOnlineUser, firstContractSlug, router])

  if (firstContractSlug) {
    return (
      <ContractContent orgSlug={orgSlug} contractSlug={firstContractSlug} />
    )
  }

  return null
}

export default Page
