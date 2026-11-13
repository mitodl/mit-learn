"use client"

import React, { useCallback, useSyncExternalStore } from "react"
import * as yup from "yup"
import { Container, styled } from "ol-components"
import { ActionButton, ButtonLink } from "@mitodl/smoot-design"
import { RiArrowRightLine, RiCloseLine } from "@remixicon/react"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagPayload } from "@/common/useFeatureFlagPayload"
import { analytics } from "@/common/analytics"

const CTA_HOSTS = new Set(["learn.mit.edu", "support.learn.mit.edu"])

const isAllowedCtaUrl = (value: string | undefined) => {
  if (!value) return false
  // Browsers read "/\" like "//", a link to another site.
  if (/^\/(?![/\\])/.test(value)) return true
  try {
    const url = new URL(value)
    return url.protocol === "https:" && CTA_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

const payloadSchema = yup.object({
  variant: yup.string().oneOf(["awareness", "sale"]).required(),
  code: yup
    .string()
    .trim()
    .when("variant", {
      is: "sale",
      then: (schema) => schema.required(),
    }),
  cta_url: yup
    .string()
    .required()
    .test("allowed-host", "cta_url is not an allowed link", isAllowedCtaUrl),
  dismiss_hours: yup.number().moreThan(0),
})

type BannerPayload = yup.InferType<typeof payloadSchema>

const COPY = {
  awareness: {
    eyebrow: "Our Cyber Sale is coming",
    date: "Starts November 24",
  },
  sale: {
    eyebrow: "Learn more this Cyber Monday",
    date: "Ends December 1",
  },
}

const storageKey = ({ variant, code }: BannerPayload) =>
  `cyber-sale-banner-dismissed:${variant}:${code ?? ""}`

/**
 * The `storage` event only fires in other tabs, so dismissing here notifies
 * this tab's listeners directly.
 */
const localListeners = new Set<() => void>()

const subscribeStorage = (onChange: () => void) => {
  localListeners.add(onChange)
  window.addEventListener("storage", onChange)
  return () => {
    localListeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}

const readStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const writeStorage = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage unavailable (e.g. blocked): the banner still hides for this page view.
  }
  localListeners.forEach((listener) => listener())
}

const isDismissed = (
  dismissedAt: string | null,
  dismissHours: number | undefined,
) => {
  if (dismissedAt === null) return false
  if (dismissHours === undefined) return true
  return Date.now() - Number(dismissedAt) < dismissHours * 60 * 60 * 1000
}

const Bar = styled.aside(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  borderBottom: `2px solid ${theme.custom.colors.red}`,
  padding: "12px 0",
}))

const Inner = styled(Container)(({ theme }) => ({
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "12px",
  },
}))

const Text = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  [theme.breakpoints.down("sm")]: {
    gap: "8px",
  },
}))

const Eyebrow = styled.p(({ theme }) => ({
  ...theme.typography.body3,
  margin: 0,
  color: theme.custom.colors.red,
  fontSize: "10px",
  lineHeight: "14px",
  fontWeight: theme.typography.fontWeightBold,
  letterSpacing: "1px",
  textTransform: "uppercase",
}))

const Details = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "flex-end",
  columnGap: "32px",
  rowGap: "8px",
  [theme.breakpoints.down("lg")]: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
}))

const Headline = styled.p(({ theme }) => ({
  ...theme.typography.body1,
  margin: 0,
  color: theme.custom.colors.darkGray2,
  strong: {
    ...theme.typography.h5,
    marginRight: "4px",
  },
  [theme.breakpoints.down("sm")]: {
    strong: {
      display: "block",
      marginRight: 0,
    },
  },
}))

const Meta = styled.p(({ theme }) => ({
  ...theme.typography.body3,
  margin: 0,
  display: "flex",
  alignItems: "center",
  gap: "16px",
  color: theme.custom.colors.silverGrayDark,
  fontWeight: theme.typography.fontWeightBold,
  whiteSpace: "nowrap",
}))

const Separator = styled.span(({ theme }) => ({
  color: theme.custom.colors.silverGrayLight,
  fontWeight: theme.typography.fontWeightMedium,
}))

const Code = styled.span(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
}))

const Actions = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "16px",
  flexShrink: 0,
})

const CloseButton = styled(ActionButton)(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    position: "absolute",
    top: 0,
    right: "16px",
  },
}))

const CyberSaleBanner: React.FC = () => {
  const payload = useFeatureFlagPayload(
    FeatureFlags.CyberSaleBanner,
    payloadSchema,
  )
  const key = payload ? storageKey(payload) : null
  const dismissedAt = useSyncExternalStore(
    subscribeStorage,
    () => (key ? readStorage(key) : null),
    () => null,
  )
  const onDismiss = useCallback(() => {
    if (key) writeStorage(key, String(Date.now()))
  }, [key])

  if (!payload || isDismissed(dismissedAt, payload.dismiss_hours)) return null

  const copy = COPY[payload.variant]
  return (
    <Bar aria-label="Cyber Sale">
      <Inner>
        <Text>
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <Details>
            <Headline>
              <strong>Save 15%</strong> on select MIT courses and programs
            </Headline>
            <Meta>
              <span>{copy.date}</span>
              {payload.variant === "sale" ? (
                <>
                  <Separator aria-hidden>|</Separator>
                  <span>
                    Use code <Code>{payload.code}</Code>
                  </span>
                </>
              ) : null}
            </Meta>
          </Details>
        </Text>
        <Actions>
          <ButtonLink
            href={payload.cta_url}
            variant="tertiary"
            size="medium"
            responsive
            endIcon={<RiArrowRightLine />}
            onClick={() =>
              analytics.ctaClicked({
                label: "View eligible courses",
                banner: "cyber-sale",
                variant: payload.variant,
              })
            }
          >
            View eligible courses
          </ButtonLink>
          <CloseButton
            variant="text"
            size="small"
            aria-label="Dismiss Cyber Sale banner"
            onClick={onDismiss}
          >
            <RiCloseLine />
          </CloseButton>
        </Actions>
      </Inner>
    </Bar>
  )
}

export default CyberSaleBanner
export { payloadSchema }
