import React from "react"
import GoogleReCAPTCHA from "react-google-recaptcha"
import styled from "@emotion/styled"

const RECAPTCHA_MARGIN_VAR = "--recaptcha-margin"

const ReCaptchaContainer = styled.div({
  display: "flex",
  justifyContent: "flex-start",
  /**
   * Reads from a CSS custom property so a consumer whose own layout already
   * provides spacing (e.g. a flex form with a `gap`) can zero this out for
   * just its subtree without needing a selector into this component's
   * internals: `[RECAPTCHA_MARGIN_VAR]: 0` on any ancestor.
   */
  margin: `var(${RECAPTCHA_MARGIN_VAR}, 12px 0)`,
  "& .g_id_signIn": {
    maxWidth: "100%",
  },
})

const ErrorText = styled.span`
  color: #c1444a;
  font-size: 0.75rem;
  display: block;
  margin-top: 4px;
`

type ReCaptchaProps = {
  onChange: (token: string | null) => void
  onExpired?: () => void
  disabled?: boolean
  error?: boolean
  helperText?: string
  siteKey?: string
  ref?: React.Ref<GoogleReCAPTCHA>
}

const ReCaptcha = ({
  onChange,
  onExpired,
  disabled = false,
  error = false,
  helperText,
  siteKey,
  ref,
}: ReCaptchaProps) => {
  if (!siteKey) {
    console.warn("ReCaptcha: No siteKey provided, skipping render")
    return null
  }

  return (
    <ReCaptchaContainer>
      <div
        aria-disabled={disabled}
        style={disabled ? { opacity: 0.6, pointerEvents: "none" } : undefined}
      >
        <GoogleReCAPTCHA
          ref={ref}
          sitekey={siteKey}
          theme="light"
          onChange={(token: string | null) => onChange(token)}
          onExpired={onExpired}
        />
        {error && helperText && <ErrorText>{helperText}</ErrorText>}
      </div>
    </ReCaptchaContainer>
  )
}

export { ReCaptcha, RECAPTCHA_MARGIN_VAR }
export type { ReCaptchaProps }
