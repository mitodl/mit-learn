"use client"

import React, { useState } from "react"
import {
  Stack,
  Typography,
  HubspotForm,
  Dialog,
  DialogActions,
  type HubspotFormInput,
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

const DialogMessage = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
}))

const DialogSuccessCheck = styled(Image)({
  alignSelf: "center",
  marginBottom: "24px",
})

const PRODUCT_OF_INTEREST_FIELD_NAME = "product_of_interest"

type StayUpdatedDialogProps = {
  productReadableId?: string
}

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

const findProductOfInterestValue = (
  hubspotForm: HubspotFormInput | undefined,
  productReadableId: string | undefined,
): string | undefined => {
  const normalizedProductReadableId = productReadableId?.trim()
  if (!normalizedProductReadableId) {
    return undefined
  }

  const fieldGroups = hubspotForm?.fieldGroups ?? hubspotForm?.field_groups

  const productOfInterestField = fieldGroups
    ?.flatMap((fieldGroup) => fieldGroup.fields ?? [])
    .find((field) => field.name === PRODUCT_OF_INTEREST_FIELD_NAME)

  const matchingOption = productOfInterestField?.options?.find(
    (option) => option.value?.trim() === normalizedProductReadableId,
  )

  return matchingOption?.value?.trim() || undefined
}

const StayUpdatedDialogInner: React.FC<StayUpdatedDialogProps> = ({
  productReadableId,
}) => {
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
          <DialogMessage variant="body1">
            Not ready to enroll? Learn what to expect in this offering.
          </DialogMessage>
          <HubspotForm
            form={hubspotForm}
            recaptchaEnabled={Boolean(recaptchaSiteKey)}
            recaptchaSiteKey={recaptchaSiteKey}
            isLoading={isLoading}
            isSubmitting={hubspotFormSubmit.isPending}
            submitLabel="Stay Updated"
            errorText={submissionError}
            actions={
              <Button variant="secondary" type="button" onClick={closeDialog}>
                Cancel
              </Button>
            }
            onSubmit={(values, _event, recaptchaToken) => {
              const fields = mapValuesToFields(values).filter(
                (field) => field.name !== PRODUCT_OF_INTEREST_FIELD_NAME,
              )
              const emailField = fields.find((field) => field.name === "email")
              if (emailField && typeof emailField.value === "string") {
                setEmail(emailField.value)
              }

              const productOfInterestValue = findProductOfInterestValue(
                hubspotForm,
                productReadableId,
              )
              if (productOfInterestValue) {
                fields.push({
                  name: PRODUCT_OF_INTEREST_FIELD_NAME,
                  value: [productOfInterestValue],
                })
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
