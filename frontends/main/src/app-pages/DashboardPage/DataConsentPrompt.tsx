import React, { useState } from "react"
import NiceModal, { useModal } from "@ebay/nice-modal-react"
import type { UserContractPage } from "@mitodl/mitxonline-api-axios/v0"
import { useDataConsentMutation } from "api/mitxonline-hooks/organizations"
import { SILENCE_ERROR_TOAST } from "api/mutation-meta"
import { DataConsentDialog } from "./DataConsentDialog"

type DataConsentPromptProps = {
  open: boolean
  contract: Pick<UserContractPage, "id" | "name">
  onAccepted?: () => void
  onDeclined: () => void
}

const DataConsentPrompt: React.FC<DataConsentPromptProps> = ({
  open,
  contract,
  onAccepted,
  onDeclined,
}) => {
  const consentMutation = useDataConsentMutation({ meta: SILENCE_ERROR_TOAST })
  // Keeps the dialog locked between a successful decline and whatever the
  // caller does next (a redirect or closing the modal).
  const [declined, setDeclined] = useState(false)

  const submit = (consented: boolean) => {
    consentMutation.mutate(
      { contract_id: contract.id, DataConsentRequest: { consented } },
      {
        onSuccess: () => {
          if (consented) {
            onAccepted?.()
          } else {
            setDeclined(true)
            onDeclined()
          }
        },
      },
    )
  }

  return (
    <DataConsentDialog
      open={open}
      contractName={contract.name}
      onAccept={() => submit(true)}
      onDecline={() => submit(false)}
      submitting={
        declined
          ? "decline"
          : consentMutation.isPending
            ? consentMutation.variables?.DataConsentRequest.consented
              ? "accept"
              : "decline"
            : null
      }
      isError={consentMutation.isError}
    />
  )
}

/** Resolves `true` if the learner agrees and `false` if they decline. */
const DataConsentModal = NiceModal.create(
  ({ contract }: { contract: Pick<UserContractPage, "id" | "name"> }) => {
    const modal = useModal()
    const finish = (consented: boolean) => {
      modal.resolve(consented)
      modal.remove()
    }
    return (
      <DataConsentPrompt
        open={modal.visible}
        contract={contract}
        onAccepted={() => finish(true)}
        onDeclined={() => finish(false)}
      />
    )
  },
)

export { DataConsentPrompt, DataConsentModal }
