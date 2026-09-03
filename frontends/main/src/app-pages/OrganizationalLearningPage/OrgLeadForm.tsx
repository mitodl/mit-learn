"use client"

import React from "react"
import { HubspotForm, styled, type HubspotFormValue } from "ol-components"
import {
  Button,
  ButtonLink,
  RadioChoiceField,
  VisuallyHidden,
  type RadioChoiceFieldProps,
} from "@mitodl/smoot-design"
import { RiArrowRightLine, RiUserLine } from "@remixicon/react"
import { usePostHog } from "posthog-js/react"
import {
  useHubspotFormDetail,
  useHubspotFormSubmit,
  type HubspotSubmitField,
} from "api/hooks/hubspot"
import { SILENCE_ERROR_TOAST } from "api/mutation-meta"
import { env } from "@/env"
import { PostHogEvents } from "@/common/constants"
import { SEARCH } from "@/common/urls"
import {
  getOrgLearningHubspotFormId,
  getRecaptchaSiteKey,
} from "@/common/config"
import { getInTouch as copy } from "./copy"

/**
 *
 * This is purely local UI state — it gates what renders and is never submitted
 * to HubSpot. The B2B and individual paths are mutually exclusive: only the
 * former is a sales lead at all.
 */
export type Audience = "organization" | "individual"

const AUDIENCE_FIELD_NAME = "org-learning-audience"

const Card = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  borderRadius: "4px",
  padding: "40px",
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  [theme.breakpoints.down("md")]: {
    padding: "16px",
  },
}))

const AudienceField = styled(RadioChoiceField)(({ theme }) => ({
  width: "100%",
  "> div:first-of-type": {
    ...theme.typography.subtitle1,
    lineHeight: "26px",
    marginBottom: "24px",
  },
  ".MuiFormGroup-root": {
    justifyContent: "space-between",
  },
  ".MuiRadio-root:not(.Mui-checked) + .MuiFormControlLabel-label": {
    color: theme.custom.colors.darkGray2,
  },
  ".MuiFormControlLabel-root": {
    alignItems: "flex-start",
    margin: 0,
  },
  ".MuiRadio-root": {
    paddingTop: 0,
  },
}))

const AudienceHint = styled.span(({ theme }) => ({
  display: "block",
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
  marginTop: "4px",
}))

const RequiredMark = styled.span(({ theme }) => ({
  color: theme.custom.colors.lightRed,
  marginLeft: "4px",
}))

const OptionTitle = styled.span(({ theme }) => ({
  ...theme.typography.subtitle2,
  display: "block",
}))

const OptionDescription = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
  display: "block",
  marginTop: "4px",
}))

const Divider = styled.hr(({ theme }) => ({
  border: "none",
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
  margin: 0,
  width: "100%",
}))

const StyledHubspotForm = styled(HubspotForm)(({ theme }) => ({
  gap: "24px",
  fieldset: {
    flexDirection: "row",
    gap: "32px",
    "> *": {
      flex: "1 1 0",
      minWidth: 0,
    },
  },
  [theme.breakpoints.down("md")]: {
    fieldset: {
      flexDirection: "column",
      gap: "16px",
    },
  },
}))

const SubmitButton = styled(Button)({
  width: "100%",
})

const IndividualPanel = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  alignItems: "center",
  textAlign: "center",
})

const IndividualIcon = styled(RiUserLine)(({ theme }) => ({
  color: theme.custom.colors.red,
  width: "40px",
  height: "40px",
}))

const IndividualTitle = styled.p(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const IndividualBody = styled.p(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.silverGrayDark,
  margin: 0,
}))

const IndividualCta = styled(ButtonLink)({
  marginTop: "8px",
})

const Message = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
})

const MessageTitle = styled.p(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const MessageBody = styled.p(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.custom.colors.silverGrayDark,
  margin: 0,
}))

const mapValuesToFields = (
  values: Record<string, HubspotFormValue>,
): HubspotSubmitField[] =>
  Object.entries(values)
    .filter(
      (entry): entry is [string, Exclude<HubspotFormValue, File>] =>
        !(entry[1] instanceof File),
    )
    .map(([name, value]) => ({ name, value }))

const OrgLeadForm: React.FC<{ className?: string }> = ({ className }) => {
  const posthog = usePostHog()
  const [audience, setAudience] = React.useState<Audience>("organization")
  const confirmation = React.useRef<HTMLDivElement>(null)

  const formId = getOrgLearningHubspotFormId()
  const recaptchaSiteKey = getRecaptchaSiteKey()

  const {
    data: hubspotForm,
    isLoading,
    isError: isFormDetailError,
  } = useHubspotFormDetail(formId ? { form_id: formId } : undefined)
  const hubspotFormSubmit = useHubspotFormSubmit({ meta: SILENCE_ERROR_TOAST })

  const isConfirmed = hubspotFormSubmit.isSuccess && audience === "organization"

  /**
   * Submitting unmounts the form along with whatever had focus, which would
   * leave focus on `document.body`, so it is placed here instead. Moving it
   * also announces the outcome — a screen reader reads the container focus
   * lands in — which is why no live region repeats this copy.
   */
  React.useEffect(() => {
    if (isConfirmed) {
      confirmation.current?.focus()
    }
  }, [isConfirmed])

  const capture = (event: string, properties?: Record<string, unknown>) => {
    if (env("NEXT_PUBLIC_POSTHOG_API_KEY")) {
      posthog.capture(event, properties)
    }
  }

  const handleAudienceChange = (
    _event: React.ChangeEvent<HTMLInputElement>,
    value: string,
  ) => {
    const next = value as Audience
    setAudience(next)
    capture(PostHogEvents.OrgLearningAudienceSelected, { audience: next })
  }

  const choices: RadioChoiceFieldProps["choices"] = [
    {
      value: "organization",
      label: (
        <>
          <OptionTitle>{copy.audience.organizationLabel}</OptionTitle>
          <OptionDescription>
            {copy.audience.organizationDescription}
          </OptionDescription>
        </>
      ),
    },
    {
      value: "individual",
      label: (
        <>
          <OptionTitle>{copy.audience.individualLabel}</OptionTitle>
          <OptionDescription>
            {copy.audience.individualDescription}
          </OptionDescription>
        </>
      ),
    },
  ]

  const submissionError = hubspotFormSubmit.isError
    ? hubspotFormSubmit.error instanceof Error
      ? hubspotFormSubmit.error.message
      : "Failed to submit the form. Please try again."
    : null

  if (isConfirmed) {
    return (
      <Card className={className}>
        <Message ref={confirmation} tabIndex={-1}>
          <MessageTitle>{copy.success.title}</MessageTitle>
          <MessageBody>{copy.success.body}</MessageBody>
        </Message>
      </Card>
    )
  }

  return (
    <Card className={className}>
      {/**
       * Mounted for every state the form passes through, so each status change
       * lands as a mutation inside a region assistive tech is already
       * watching. A live region added to the tree with its text already in it
       * is not reliably announced. The success outcome is not routed through
       * here — focus moves to the confirmation, which announces it.
       */}
      <VisuallyHidden aria-live="polite" aria-atomic="true">
        {hubspotFormSubmit.isPending
          ? copy.submitting
          : isLoading
            ? copy.loading
            : ""}
      </VisuallyHidden>
      <AudienceField
        name={AUDIENCE_FIELD_NAME}
        value={audience}
        onChange={handleAudienceChange}
        choices={choices}
        label={
          <>
            {copy.audience.label}
            <RequiredMark aria-hidden="true">*</RequiredMark>
            <AudienceHint>{copy.audience.hint}</AudienceHint>
          </>
        }
      />

      <Divider />

      {audience === "individual" ? (
        <IndividualPanel>
          <IndividualIcon aria-hidden />
          <IndividualTitle>{copy.individual.title}</IndividualTitle>
          <IndividualBody>{copy.individual.body}</IndividualBody>
          <IndividualCta
            href={SEARCH}
            variant="primary"
            size="large"
            endIcon={<RiArrowRightLine />}
          >
            {copy.individual.ctaLabel}
          </IndividualCta>
        </IndividualPanel>
      ) : !formId || isFormDetailError ? (
        <MessageBody role="alert">{copy.unavailable}</MessageBody>
      ) : isLoading ? (
        /**
         * HubspotForm renders nothing at all until it has a form definition —
         * its own `isLoading` branch sits behind that early return — so the
         * wait is covered here instead. Presentational because the live region
         * above already announces it; without this it is read twice.
         */
        <MessageBody aria-hidden="true">{copy.loading}</MessageBody>
      ) : (
        <StyledHubspotForm
          form={hubspotForm}
          isSubmitting={hubspotFormSubmit.isPending}
          recaptchaEnabled={Boolean(recaptchaSiteKey)}
          recaptchaSiteKey={recaptchaSiteKey}
          errorText={submissionError}
          submitButton={
            <SubmitButton
              type="submit"
              variant="primary"
              size="large"
              disabled={hubspotFormSubmit.isPending}
              aria-busy={hubspotFormSubmit.isPending}
            >
              {copy.submitLabel}
            </SubmitButton>
          }
          onSubmit={(values, _event, recaptchaToken) => {
            hubspotFormSubmit.mutate(
              {
                formId,
                fields: mapValuesToFields(values),
                recaptchaToken,
              },
              {
                onSuccess: () =>
                  capture(PostHogEvents.OrgLearningFormSubmitted, { audience }),
              },
            )
          }}
        />
      )}
    </Card>
  )
}

export default OrgLeadForm
