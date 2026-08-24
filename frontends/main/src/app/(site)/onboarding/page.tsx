import type { AppPageProps } from "@/common/searchParams"
import React from "react"
import { Metadata } from "next"
import { standardizeMetadata } from "@/common/metadata"
import { Permission } from "api/hooks/user"
import RestrictedRoute from "@/components/RestrictedRoute/RestrictedRoute"
import OnboardingPage from "@/app-pages/OnboardingPage/OnboardingPage"

export const metadata: Metadata = standardizeMetadata({
  title: "Onboarding",
  social: false,
})

const Page: React.FC<AppPageProps<"/onboarding">> = () => {
  return (
    <RestrictedRoute requires={Permission.Authenticated}>
      <OnboardingPage />
    </RestrictedRoute>
  )
}

export default Page
