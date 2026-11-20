"use client"

import React, { useCallback, useSyncExternalStore } from "react"
import * as yup from "yup"
import { Container, styled } from "ol-components"
import { ActionButton, ButtonLink } from "@mitodl/smoot-design"
import { RiCloseLine } from "@remixicon/react"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagResult } from "@/common/useFeatureFlagResult"
import { analytics } from "@/common/analytics"

const payloadSchema = yup.object({
  eyebrow: yup.string().required(),
  /** Plain text; a run wrapped in `**` is shown bold. */
  text: yup.string().required(),
  link_url: yup
    .string()
    .required()
    .url()
    .matches(/^https:\/\//),
  link_text: yup.string().required(),
  /** Raising it shows the banner again to everyone who dismissed it. */
  revision: yup.number().integer().min(0),
  dismiss_hours: yup.number().moreThan(0),
})

const storageKey = (
  variant: string | undefined,
  revision: number | undefined,
) => `cyber-sale-banner-dismissed:${variant ?? ""}:${revision ?? 0}`

/**
 * Bolds each run between a pair of `**` markers. An odd number of markers
 * leaves one unpaired, so the text is shown as typed and the stray marker is
 * visible to whoever edited the payload.
 *
 * Bold is deliberately the only markup. Don't grow this into a Markdown
 * subset (italics, links, nesting): if banner copy needs richer formatting,
 * it should come from a rich-text source such as a CMS, not a hand-rolled
 * parser over a flag payload.
 */
const withBold = (text: string): React.ReactNode => {
  const parts = text.split("**")
  if (parts.length % 2 === 0) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
  )
}

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
  borderBottom: `1px solid ${theme.custom.colors.red}`,
  boxShadow: "0 4px 6px rgba(33, 35, 38, 0.05)",
  padding: "20px 0",
  "@media print": { display: "none" },
  [theme.breakpoints.down("sm")]: {
    boxShadow: "0 4px 6px rgba(33, 35, 38, 0.1)",
    padding: "16px 0",
  },
}))

const Inner = styled(Container)(({ theme }) => ({
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "40px",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "12px",
  },
}))

const Copy = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  [theme.breakpoints.down("sm")]: {
    // Keeps the first lines clear of the close button.
    paddingRight: "32px",
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

const Text = styled.p(({ theme }) => ({
  ...theme.typography.body1,
  margin: 0,
  color: theme.custom.colors.darkGray2,
  strong: {
    fontWeight: theme.typography.fontWeightBold,
  },
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.body2Loose,
  },
}))

const Actions = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "40px",
  flexShrink: 0,
  [theme.breakpoints.down("sm")]: {
    display: "contents",
  },
}))

/**
 * The tertiary button hovers to white, which on this white bar leaves a
 * borderless label; a lighter gray keeps its edge visible.
 */
const LinkButton = styled(ButtonLink)(({ theme }) => ({
  ":hover:not(:disabled)": {
    backgroundColor: theme.custom.colors.lightGray1,
  },
}))

const CloseButton = styled(ActionButton)(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    // Measured from the container's padding box, which starts below the
    // bar's 16px padding: this puts the icon 12px from the bar's top and
    // right edges.
    position: "absolute",
    top: "-12px",
    right: "4px",
  },
}))

const CyberSaleBanner: React.FC = () => {
  const flag = useFeatureFlagResult(FeatureFlags.CyberSaleBanner, payloadSchema)
  const payload = flag?.enabled ? flag.payload : undefined
  const key = payload ? storageKey(flag?.variant, payload.revision) : null
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
        <Copy>
          <Eyebrow>{payload.eyebrow}</Eyebrow>
          <Text>{withBold(payload.text)}</Text>
        </Copy>
        <Actions>
          <LinkButton
            href={payload.link_url}
            variant="tertiary"
            size="medium"
            responsive
            onClick={() =>
              analytics.ctaClicked({
                label: payload.link_text,
                banner: "cyber-sale",
                variant: flag?.variant,
              })
            }
          >
            {payload.link_text}
          </LinkButton>
          <CloseButton
            variant="text"
            size="medium"
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
