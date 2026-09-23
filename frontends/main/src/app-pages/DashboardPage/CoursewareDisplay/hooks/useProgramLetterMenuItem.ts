import { useQuery } from "@tanstack/react-query"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { SimpleMenuItem } from "ol-components"
import { programCertificateQueries } from "api/hooks/programCertificates/queries"
import { FeatureFlags } from "@/common/feature_flags"

/**
 * The "Program Letter" item for a program card's menu, or null when the learner
 * has no letter for that program.
 *
 * A program letter exists only for a MicroMasters program certificate, which
 * reaches Learn through the warehouse sync rather than from MITx Online, so the
 * two are joined on the certificate's `mitxonline_program_id`. A certificate
 * whose `mitxonline_program_id` is null has no card to attach to and is not
 * reachable from the dashboard.
 *
 * The certificate list is only requested once the flag has resolved to true:
 * reading it mints a shareable uuid for every letter the learner does not have
 * yet, which should not happen for learners who cannot see the link.
 */
const useProgramLetterMenuItem = (
  mitxonlineProgramId: number,
): SimpleMenuItem | null => {
  const flagEnabled = useFeatureFlagEnabled(FeatureFlags.ProgramLetters)
  const { data: certificates } = useQuery({
    ...programCertificateQueries.list(),
    // Not `!!flagEnabled`: the flag is undefined until PostHog resolves it, and
    // only an explicit true should trigger the request.
    enabled: flagEnabled === true,
  })

  const shareUrl = certificates?.find(
    (certificate) => certificate.mitxonline_program_id === mitxonlineProgramId,
  )?.program_letter_share_url

  if (!shareUrl) return null

  return {
    className: "dashboard-card-menu-item",
    key: "program-letter",
    label: "Program Letter",
    href: shareUrl,
  }
}

export { useProgramLetterMenuItem }
