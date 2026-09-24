import { queryOptions } from "@tanstack/react-query"
import { programCertificatesApi } from "../../clients"

const programCertificateKeys = {
  root: ["programCertificates"],
  list: () => [...programCertificateKeys.root, "list"],
}

const programCertificateQueries = {
  /**
   * The signed-in user's MicroMasters program certificates, each carrying the
   * shareable `program_letter_share_url` for its program letter.
   *
   * Requesting this creates any program letters the user does not have yet —
   * the letter uuid is minted on first read, by design — so it is only fetched
   * where a letter link is actually rendered.
   */
  list: () =>
    queryOptions({
      queryKey: programCertificateKeys.list(),
      queryFn: () =>
        programCertificatesApi
          .programCertificatesList()
          .then((res) => res.data),
    }),
}

export { programCertificateQueries, programCertificateKeys }
