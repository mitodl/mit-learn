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
  getRecaptchaSiteKey,
  getStayUpdatedHubspotFormId,
} from "@/common/config"
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
  const modalState = NiceModal.useModal()
  const modal = muiDialogV5(modalState)
  const stayUpdatedFormId = getStayUpdatedHubspotFormId()
  const recaptchaSiteKey = getRecaptchaSiteKey()
  const { data: hubspotForm, isLoading } = useHubspotFormDetail(
    stayUpdatedFormId ? { form_id: stayUpdatedFormId } : undefined,
  )
  const hubspotFormSubmit = useHubspotFormSubmit()
  const [email, setEmail] = useState("")

  const closeDialog = async () => {
    await modalState.hide()
    hubspotFormSubmit.reset()
    setEmail("")
  }

  const submissionError = hubspotFormSubmit.isError
    ? hubspotFormSubmit.error instanceof Error
      ? hubspotFormSubmit.error.message
      : "Failed to submit form. Please try again."
    : null
  const doneButton = (
    <DialogActions>
      <Button variant="primary" onClick={closeDialog}>
        Done
      </Button>
    </DialogActions>
  )

  return (
    <Dialog
      {...modal}
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
              <Button variant="secondary" type="button" onClick={closeDialog}>
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
