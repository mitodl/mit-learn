import { useQuery } from "@tanstack/react-query"
import { programCertificateQueries } from "./queries"

/**
 * The signed-in user's program certificates. Pass `enabled: false` to skip the
 * request (and the letter creation it triggers) when no letter link is shown.
 */
const useProgramCertificatesList = ({ enabled = true } = {}) => {
  return useQuery({ ...programCertificateQueries.list(), enabled })
}

export { useProgramCertificatesList }
