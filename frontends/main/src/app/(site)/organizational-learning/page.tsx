import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import OrganizationalLearningPage from "@/app-pages/OrganizationalLearningPage/OrganizationalLearningPage"

/**
 * standardizeMetadata rather than getMetadataAsync: this page renders no
 * learning-resource cards, so the resource drawer can never be opened on it and
 * there is no `?resource=` variant that would need its own canonical.
 */
export const metadata: Metadata = standardizeMetadata({
  title: "Learning Solutions for Organizations",
  description:
    "MIT learning programs for businesses, government, and higher education institutions. Talk with our team about a solution for your organization.",
})

const Page: React.FC = () => <OrganizationalLearningPage />

export default Page
