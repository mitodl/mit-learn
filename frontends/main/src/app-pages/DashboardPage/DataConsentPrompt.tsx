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
  onCancelled: () => void
}

/**
 * Only agreeing is sent to MITx Online. Cancelling records nothing; it just
 * hands control back to the caller.
 */
const DataConsentPrompt: React.FC<DataConsentPromptProps> = ({
  open,
  contract,
  onAccepted,
  onCancelled,
}) => {
  const consentMutation = useDataConsentMutation({ meta: SILENCE_ERROR_TOAST })
  // Keeps the dialog locked between Cancel and whatever the caller does next
  // (a redirect or closing the modal).
  const [cancelled, setCancelled] = useState(false)

  const accept = () => {
    consentMutation.mutate(
      { contract_id: contract.id, DataConsentRequest: { consented: true } },
      { onSuccess: () => onAccepted?.() },
    )
  }

  const cancel = () => {
    setCancelled(true)
    onCancelled()
  }

  return (
    <DataConsentDialog
      open={open}
      contractName={contract.name}
      onAccept={accept}
      onCancel={cancel}
      submitting={
        cancelled ? "cancel" : consentMutation.isPending ? "accept" : null
      }
      isError={consentMutation.isError}
    />
  )
}

/** Resolves `true` if the learner agrees and `false` if they cancel. */
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
        onCancelled={() => finish(false)}
      />
    )
  },
)

export { DataConsentPrompt, DataConsentModal }
