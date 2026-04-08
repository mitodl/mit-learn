"use client"

import React, { useState } from "react"
import {
  Stack,
  Typography,
  HubspotForm,
  Dialog,
  DialogActions,
  type HubspotFormValue,
} from "ol-components"
import { Button, styled } from "@mitodl/smoot-design"
import Image from "next/image"
import NiceModal, { muiDialogV5 } from "@ebay/nice-modal-react"
import IconCheck from "@/public/images/product/icon_check.svg"
import {
  useHubspotFormDetail,
  useHubspotFormSubmit,
  type HubspotSubmitField,
} from "api/hooks/hubspot"

const StayUpdatedDialogContainer = styled.div(({ theme }) => ({
  minWidth: "516px",
  padding: "24px",
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  [theme.breakpoints.down("sm")]: {
    minWidth: "100%",
  },
}))

const DialogSuccessCheck = styled(Image)({
  alignSelf: "center",
})

const getStayUpdatedHubspotFormId = () =>
  (process.env.NEXT_PUBLIC_STAY_UPDATED_HUBSPOT_FORM_ID ?? "").trim()

const mapValuesToFields = (
  values: Record<string, HubspotFormValue>,
): HubspotSubmitField[] => {
  return Object.entries(values)
    .filter(
      (entry): entry is [string, Exclude<HubspotFormValue, File>] =>
        !(entry[1] instanceof File),
    )
    .map(([name, value]) => ({ name, value }))
}

const StayUpdatedDialogInner: React.FC = () => {
  const modal = NiceModal.useModal()
  const stayUpdatedFormId = getStayUpdatedHubspotFormId()
  const recaptchaSiteKey =
    (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? "").trim() || undefined
  const { data: hubspotForm, isLoading } = useHubspotFormDetail(
    stayUpdatedFormId ? { form_id: stayUpdatedFormId } : undefined,
  )
  const hubspotFormSubmit = useHubspotFormSubmit()
  const [email, setEmail] = useState("")
  const wasVisibleRef = React.useRef(modal.visible)

  React.useEffect(() => {
    if (wasVisibleRef.current && !modal.visible) {
      hubspotFormSubmit.reset()
      setEmail("")
    }
    wasVisibleRef.current = modal.visible
  }, [hubspotFormSubmit, modal.visible])

  const submissionError = hubspotFormSubmit.isError
    ? hubspotFormSubmit.error instanceof Error
      ? hubspotFormSubmit.error.message
      : "Failed to submit form. Please try again."
    : null
  const doneButton = (
    <DialogActions>
      <Button variant="primary" onClick={() => modal.hide()}>
        Done
      </Button>
    </DialogActions>
  )

  return (
    <Dialog
      {...muiDialogV5(modal)}
      title={"Stay Updated"}
      actions={hubspotFormSubmit.isSuccess ? doneButton : null}
      contentCss={{ margin: 0 }}
    >
      {!hubspotFormSubmit.isSuccess && (
        <StayUpdatedDialogContainer>
          <HubspotForm
            form={hubspotForm}
            recaptchaEnabled={Boolean(recaptchaSiteKey)}
            recaptchaSiteKey={recaptchaSiteKey}
            isLoading={isLoading}
            isSubmitting={hubspotFormSubmit.isPending}
            submitLabel="Notify Me"
            errorText={submissionError}
            actions={
              <Button variant="secondary" type="button" onClick={modal.hide}>
                Cancel
              </Button>
            }
            onSubmit={(values, _event, recaptchaToken) => {
              const fields = mapValuesToFields(values)
              const emailField = fields.find((field) => field.name === "email")
              if (emailField && typeof emailField.value === "string") {
                setEmail(emailField.value)
              }
              hubspotFormSubmit.mutate({
                formId: stayUpdatedFormId,
                fields,
                recaptchaToken,
              })
            }}
          />
        </StayUpdatedDialogContainer>
      )}
      {hubspotFormSubmit.isSuccess && (
        <StayUpdatedDialogContainer>
          <Stack alignItems="center">
            <DialogSuccessCheck
              src={IconCheck}
              width="64"
              height="64"
              alt=""
              aria-hidden
            />
            <Typography variant="body1" color="black" align="center">
              Thanks! We&apos;ll keep you updated at <strong>{email}</strong>
            </Typography>
          </Stack>
        </StayUpdatedDialogContainer>
      )}
    </Dialog>
  )
}

export const StayUpdatedModal = NiceModal.create(StayUpdatedDialogInner)
export { getStayUpdatedHubspotFormId }
