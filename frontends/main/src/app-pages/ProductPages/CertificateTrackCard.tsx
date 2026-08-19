import React from "react"
import { styled } from "@mitodl/smoot-design"
import { linkStyles } from "ol-components"
import TrackCard, {
  FeatureRow,
  FeatureIcon,
  AccessFeatureRow,
} from "./TrackCard"

/**
 * `linkStyles`' small "red" link is the body3 scale the card wants, and its red
 * is the call-to-action colour for the unapplied state. The approved state keeps
 * that scale and swaps only the colour, which Link has no variant for: green
 * marks it as a resolved state rather than something to act on, so it also drops
 * the resting underline and takes one on hover instead — it stays a link to the
 * application record, but users have no reason to follow it.
 *
 * The colour is `darkGreen` rather than the `green` used for the feature check
 * icons, which is only 2.7:1 against the card and fails AA as text.
 */
const FinancialAidLink = styled.a<{ $applied?: boolean }>(
  linkStyles({ size: "small", color: "red" }),
  ({ theme, $applied }) =>
    $applied
      ? {
          color: theme.custom.colors.darkGreen,
          ":hover": {
            color: theme.custom.colors.darkGreen,
            textDecoration: "underline",
          },
        }
      : { textDecoration: "underline" },
)

type CertificateTrackCardProps = {
  price: React.ReactNode
  compactPrice?: boolean
  financialAid?: { href: string; applied: boolean } | null
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
          <FinancialAidLink
            href={financialAid.href}
            $applied={financialAid.applied}
          >
            {financialAid.applied
              ? "Financial aid applied (visible at checkout)"
              : "Apply for financial aid"}
          </FinancialAidLink>
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
