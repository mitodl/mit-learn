"use client"

import React, { useCallback, useSyncExternalStore } from "react"
import * as yup from "yup"
import { Container, styled } from "ol-components"
import { ActionButton, ButtonLink } from "@mitodl/smoot-design"
import { RiArrowRightLine, RiCloseLine } from "@remixicon/react"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagResult } from "@/common/useFeatureFlagResult"
import { analytics } from "@/common/analytics"

const payloadSchema = yup.object({
  eyebrow: yup.string().required(),
  headline_bold: yup.string().required(),
  headline: yup.string().required(),
  date: yup.string().required(),
  code: yup.string().trim(),
  cta_url: yup
    .string()
    .url()
    .matches(/^https:\/\//),
  dismiss_hours: yup.number().moreThan(0),
})

const storageKey = (variant: string | undefined, code: string | undefined) =>
  `cyber-sale-banner-dismissed:${variant ?? ""}:${code ?? ""}`

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

/** So dismissing still works for this visit when localStorage is blocked or full. */
const memoryStorage = new Map<string, string>()

const readStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key) ?? memoryStorage.get(key) ?? null
  } catch {
    return memoryStorage.get(key) ?? null
  }
}

const writeStorage = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    memoryStorage.set(key, value)
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
  "@media print": { display: "none" },
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
  alignItems: "baseline",
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
  alignItems: "baseline",
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

const Actions = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "16px",
  flexShrink: 0,
  [theme.breakpoints.down("sm")]: {
    display: "contents",
  },
}))

const CloseButton = styled(ActionButton)(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    position: "absolute",
    top: 0,
    right: "16px",
  },
}))

const CyberSaleBanner: React.FC = () => {
  const flag = useFeatureFlagResult(FeatureFlags.CyberSaleBanner, payloadSchema)
  const payload = flag?.enabled ? flag.payload : undefined
  const key = payload ? storageKey(flag?.variant, payload.code) : null
  const dismissedAt = useSyncExternalStore(
    subscribeStorage,
    () => (key ? readStorage(key) : null),
    () => null,
  )
  const onDismiss = useCallback(() => {
    if (key) writeStorage(key, String(Date.now()))
  }, [key])

  if (!payload || isDismissed(dismissedAt, payload.dismiss_hours)) return null

  return (
    <Bar aria-label="Cyber Sale">
      <Inner>
        <Text>
          <Eyebrow>{payload.eyebrow}</Eyebrow>
          <Details>
            <Headline>
              <strong>{payload.headline_bold}</strong> {payload.headline}
            </Headline>
            <Meta>
              <span>{payload.date}</span>
              {payload.code ? (
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
          {payload.cta_url ? (
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
                  variant: flag?.variant,
                })
              }
            >
              View eligible courses
            </ButtonLink>
          ) : null}
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
