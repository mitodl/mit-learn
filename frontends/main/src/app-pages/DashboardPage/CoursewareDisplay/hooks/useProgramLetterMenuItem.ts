import { useQuery } from "@tanstack/react-query"
import { SimpleMenuItem } from "ol-components"
import { programCertificateQueries } from "api/hooks/programCertificates/queries"

/**
 * The "Program Letter" item for a program card's menu, or null when the learner
 * has no letter for that program.
 *
 * A program letter exists only for a MicroMasters program certificate, which
 * reaches Learn through the warehouse sync rather than from MITx Online, so the
 * two are joined on the certificate's `mitxonline_program_id`. A certificate
 * whose `mitxonline_program_id` is null has no card to attach to and is not
 * reachable from the dashboard. A certificate with no letter (one whose program
 * has no MicroMasters id) has a null `program_letter_share_url` and gets no item.
 */
const useProgramLetterMenuItem = (
  mitxonlineProgramId: number,
): SimpleMenuItem | null => {
  const { data: certificates } = useQuery(programCertificateQueries.list())

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
