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
  const authed = user?.is_authenticated ? user : undefined
  const email = authed?.email
  const name = authed?.profile?.name
  const username = authed?.username
  const settings = React.useMemo(
    () => getContactUsSettings({ email, name, username }),
    [email, name, username],
  )

  if (!flagsLoaded || !enabled || !isContactUsEnabled()) {
    return null
  }

  return <ContactUsLauncher settings={settings} />
}

export default ContactUsLauncherGate
