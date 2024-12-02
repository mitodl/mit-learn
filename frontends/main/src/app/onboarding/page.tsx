import React from "react"
import { Metadata } from "next"
import OnboardingPage from "@/app-pages/OnboardingPage/OnboardingPage"
import { standardizeMetadata } from "@/common/metadata"
import { Permission } from "api/hooks/user"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"

export const metadata: Metadata = standardizeMetadata({
  title: "Onboarding",
  social: false,
})

const Page: React.FC = () => {
  return (
    <RestrictedRoute requires={Permission.Authenticated}>
      <OnboardingPage />
    </RestrictedRoute>
  )
}

export default Page
