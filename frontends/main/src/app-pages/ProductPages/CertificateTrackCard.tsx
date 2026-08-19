import React from "react"
import { styled } from "@mitodl/smoot-design"
import { linkStyles } from "ol-components"
import type { FinancialAid } from "./enrollTypes"
import TrackCard, {
  FeatureRow,
  FeatureIcon,
  AccessFeatureRow,
} from "./TrackCard"

/**
 * `linkStyles`' small "red" link is the body3 scale the card wants, and its red
 * is the call-to-action colour for the unapproved state. The approved state
 * keeps that scale and swaps only the colour, which Link has no variant for:
 * green marks it as a resolved state rather than something to act on, so it also
 * drops the resting underline and takes one on hover instead — it stays a link
 * to the application record, but users have no reason to follow it.
 *
 * The green matches the `Save $X+` text in ProgramSavingsBlock, which can sit a
 * few rows below it in the same card. It is a raw hex in both places: the
 * `green` token is only 2.7:1 against the card and fails AA as text, and no
 * other token is this shade.
 */
const APPROVED_GREEN = "#008000"

const FinancialAidLink = styled.a<{ $approved?: boolean }>(
  linkStyles({ size: "small", color: "red" }),
  ({ $approved }) =>
    $approved
      ? {
          color: APPROVED_GREEN,
          ":hover": { color: APPROVED_GREEN, textDecoration: "underline" },
        }
      : { textDecoration: "underline" },
)

/**
 * Holds the aid link's row while the approval lookup is in flight, so resolving
 * it does not shift the rest of the card. Sized by the link's own line box.
 */
const FinancialAidPlaceholder = styled.span(({ theme }) => ({
  display: "block",
  height: theme.typography.body3.lineHeight,
}))

type CertificateTrackCardProps = {
  price: React.ReactNode
  compactPrice?: boolean
  financialAid?: FinancialAid | null
  productNoun: "course" | "program"
  priceBlock?: React.ReactNode
  action?: React.ReactNode
  fill?: boolean
}

const CertificateTrackCard: React.FC<CertificateTrackCardProps> = ({
  price,
  compactPrice,
  financialAid,
  productNoun,
  priceBlock,
  action,
  fill,
}) => {
  return (
    <TrackCard
      variant="shaded"
      title="Certificate Track"
      subtitle="Earn a verified certificate of completion"
      price={price}
      compactPrice={compactPrice}
      priceBlock={priceBlock}
      headerAside={
        financialAid ? (
          financialAid.pending ? (
            <FinancialAidPlaceholder />
          ) : (
            <FinancialAidLink
              href={financialAid.href}
              $approved={financialAid.applied}
            >
              {financialAid.applied
                ? "Financial aid approved (visible at checkout)"
                : "Apply for financial aid"}
            </FinancialAidLink>
          )
        ) : null
      }
      action={action}
      fill={fill}
    >
      <AccessFeatureRow productNoun={productNoun} />
      <FeatureRow>
        <FeatureIcon aria-hidden="true" />
        <span>Graded assignments &amp; exams</span>
      </FeatureRow>
      <FeatureRow>
        <FeatureIcon aria-hidden="true" />
        <span>MIT certificate on completion</span>
      </FeatureRow>
    </TrackCard>
  )
}

export default CertificateTrackCard
