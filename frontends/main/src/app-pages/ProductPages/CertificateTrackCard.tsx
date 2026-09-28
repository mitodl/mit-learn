import React from "react"
import type { FinancialAid } from "./enrollTypes"
import { FinancialAidIndicator } from "./EnrollAreaParts"
import TrackCard, {
  FeatureRow,
  FeatureIcon,
  AccessFeatureRow,
} from "./TrackCard"

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
          <FinancialAidIndicator financialAid={financialAid} />
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
        <span>MIT Open Learning certificate of completion</span>
      </FeatureRow>
    </TrackCard>
  )
}

export default CertificateTrackCard
