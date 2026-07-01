import React from "react"
import { styled } from "@mitodl/smoot-design"
import TrackCard, { FeatureRow, FeatureIcon } from "./TrackCard"

const FinancialAidLink = styled.a(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.darkGray2,
  textDecoration: "underline",
}))

type CertificateTrackCardProps = {
  price: React.ReactNode
  financialAid?: { href: string; applied: boolean } | null
  productNoun: "course" | "program"
  action?: React.ReactNode
  fill?: boolean
}

const CertificateTrackCard: React.FC<CertificateTrackCardProps> = ({
  price,
  financialAid,
  productNoun,
  action,
  fill,
}) => {
  return (
    <TrackCard
      variant="shaded"
      title="Certificate Track"
      subtitle="Earn a verified certificate of completion"
      price={price}
      action={action}
      fill={fill}
    >
      <FeatureRow>
        <FeatureIcon aria-hidden="true" />
        <span>Access to this {productNoun} &amp; course materials</span>
      </FeatureRow>
      <FeatureRow>
        <FeatureIcon aria-hidden="true" />
        <span>Graded assignments &amp; exams</span>
      </FeatureRow>
      <FeatureRow>
        <FeatureIcon aria-hidden="true" />
        <span>MIT certificate on completion</span>
      </FeatureRow>
      {financialAid !== null && financialAid !== undefined && (
        <FeatureRow>
          <FeatureIcon aria-hidden="true" />
          <FinancialAidLink href={financialAid.href}>
            {financialAid.applied
              ? "Financial assistance approved (applied at checkout)"
              : "Financial assistance available"}
          </FinancialAidLink>
        </FeatureRow>
      )}
    </TrackCard>
  )
}

export default CertificateTrackCard
