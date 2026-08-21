import React from "react"
import AnalyticsContent from "@/app-pages/DashboardPage/AnalyticsContent"

/**
 * The contract-scoped view of the same dashboard rendered by
 * `[orgSlug]/analytics`. Nested under the contract because that is where a
 * manager arrives from — MITx Online's manager dashboard is contract-scoped in
 * the same shape (`manager/organizations/{org}/contracts/{contract}`).
 */
const Page: React.FC<
  PageProps<"/dashboard/organization/[orgSlug]/contract/[contractSlug]/analytics">
> = async ({ params }) => {
  const resolved = await params
  return (
    <AnalyticsContent
      orgSlug={resolved.orgSlug}
      contractSlug={resolved.contractSlug}
    />
  )
}

export default Page
