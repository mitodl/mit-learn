import React from "react"
import NiceModal from "@ebay/nice-modal-react"
import { usePathname } from "next/navigation"
import { useRouter } from "next-nprogress-bar"
import { useFeatureFlagEnabled } from "posthog-js/react"
import type { UserContractPage } from "@mitodl/mitxonline-api-axios/v2"
import { FeatureFlags } from "@/common/feature_flags"
import { DASHBOARD_HOME } from "@/common/urls"
import { DataConsentModal } from "./DataConsentPrompt"
import { useDashboardAnnounce } from "./DashboardAnnouncer"

type GatedLinkProps = {
  onClick?: React.MouseEventHandler
  "data-disable-nprogress"?: "true"
}

/**
 * Asks for data consent before following an in-app link to a contract
 * dashboard. Declining goes to dashboard home instead.
 */
const useConsentGatedNavigation = () => {
  const consentFlag = useFeatureFlagEnabled(FeatureFlags.B2BDataConsent)
  const router = useRouter()
  const pathname = usePathname()
  const announce = useDashboardAnnounce()

  return React.useCallback(
    (
      contract: Pick<
        UserContractPage,
        "id" | "name" | "consented_to_data_sharing"
      >,
      href: string,
    ): GatedLinkProps => {
      if (consentFlag !== true || contract.consented_to_data_sharing === true) {
        return {}
      }
      return {
        // next-nprogress-bar starts its bar on anchor clicks before React
        // handlers run, so it would start even though the click is cancelled.
        "data-disable-nprogress": "true",
        onClick: (event) => {
          event.preventDefault()
          NiceModal.show(DataConsentModal, { contract }).then((result) => {
            if (result === true) {
              announce(`Consent recorded. Opening ${contract.name}.`)
              router.push(href)
            } else {
              announce("Response recorded.")
              if (pathname !== DASHBOARD_HOME) router.push(DASHBOARD_HOME)
            }
          })
        },
      }
    },
    [consentFlag, router, pathname, announce],
  )
}

export { useConsentGatedNavigation }
export type { GatedLinkProps }
