import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { Permissions } from "@/common/permissions"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import OnboardingPage from "@/app-pages/OnboardingPage/OnboardingPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Onboarding",
  social: false,
})

const Page: React.FC = () => {
  return (
    <RestrictedRoute requires={Permissions.Authenticated}>
      <OnboardingPage />
    </RestrictedRoute>
  )
}

export default Page
