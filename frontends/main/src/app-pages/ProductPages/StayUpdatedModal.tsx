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
  const { mutate: submitForm, isPending } = useHubspotFormSubmit()
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
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
      actions={submitted ? doneButton : null}
      contentCss={{ margin: 0 }}
    >
      {!submitted && (
        <StayUpdatedDialogContainer>
          {submissionError && (
            <Typography
              variant="body2"
              color="error"
              align="center"
              role="alert"
            >
              {submissionError}
            </Typography>
          )}
          <HubspotForm
            form={hubspotForm}
            recaptchaEnabled={Boolean(recaptchaSiteKey)}
            recaptchaSiteKey={recaptchaSiteKey}
            isLoading={isLoading}
            isSubmitting={isPending}
            submitLabel="Notify Me"
            actions={
              <Button variant="secondary" type="button" onClick={modal.hide}>
                Cancel
              </Button>
            }
            onSubmit={(values, _event, recaptchaToken) => {
              // Clear previous errors when user retries
              setSubmissionError(null)
              const fields = mapValuesToFields(values)
              const emailField = fields.find((field) => field.name === "email")
              if (emailField && typeof emailField.value === "string") {
                setEmail(emailField.value)
              }
              submitForm(
                { formId: stayUpdatedFormId, fields, recaptchaToken },
                {
                  onSuccess: () => {
                    setSubmissionError(null)
                    setSubmitted(true)
                  },
                  onError: (error) => {
                    const errorMessage =
                      error instanceof Error
                        ? error.message
                        : "Failed to submit form. Please try again."
                    setSubmissionError(errorMessage)
                  },
                },
              )
            }}
          />
        </StayUpdatedDialogContainer>
      )}
      {submitted && (
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
