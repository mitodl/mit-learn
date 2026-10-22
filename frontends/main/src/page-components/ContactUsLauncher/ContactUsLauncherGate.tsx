"use client"

import React from "react"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { ContactUsLauncher } from "@mitodl/smoot-design/contact-us"
import { useUserMe } from "api/hooks/user"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { isContactUsEnabled, getContactUsSettings } from "./contactUsConfig"

const ContactUsLauncherGate: React.FC = () => {
  const enabled = useFeatureFlagEnabled(FeatureFlags.ContactUs)
  const flagsLoaded = useFeatureFlagsLoaded()
  const { data: user } = useUserMe()

  if (!flagsLoaded || !enabled || !isContactUsEnabled()) {
    return null
  }

  const userEmail = user?.is_authenticated ? user.email : undefined
  return <ContactUsLauncher settings={getContactUsSettings(userEmail)} />
}

export default ContactUsLauncherGate
