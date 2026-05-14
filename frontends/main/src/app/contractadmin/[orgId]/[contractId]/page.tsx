import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import invariant from "tiny-invariant"
import ContractAdminPage from "@/app-pages/ContractAdminPage/ContractAdminPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Contract Admin",
})

const Page: React.FC<
  PageProps<"/contractadmin/[orgId]/[contractId]">
> = async ({ params }) => {
  const resolved = await params
  invariant(resolved?.orgId, "orgId is required")
  invariant(resolved?.contractId, "contractId is required")

  const orgId = Number(resolved.orgId)
  const contractId = Number(resolved.contractId)
  invariant(
    Number.isFinite(orgId) && !Number.isNaN(orgId),
    "orgId must be numeric",
  )
  invariant(
    Number.isFinite(contractId) && !Number.isNaN(contractId),
    "contractId must be numeric",
  )

  return <ContractAdminPage orgId={orgId} contractId={contractId} />
}

export default Page
