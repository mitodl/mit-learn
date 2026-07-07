import React from "react"
import { VisuallyHidden } from "@mitodl/smoot-design"
import { HeadingIds } from "./util"
import { InfoBoxCard, InfoBoxColumn } from "./InfoBoxParts"
import { ProductPageAskTimSection } from "./ProductPageAskTim"
import { BoxGrid, SectionDivider } from "./InfoBoxGrid"

type InfoBoxLayoutProps = {
  /** Visually-hidden card heading, e.g. "Course Information". */
  heading: string
  /**
   * How many offering boxes (cert/free) the enroll area will render: 0 | 1 | 2.
   * Drives the count-aware grid CSS (`data-boxes`) and the tablet metadata
   * column split. offeringBoxCount owns the enrolled/offering → count mapping;
   * its inputs are shared with the enroll hook, but the count → cells mapping is
   * mirrored by what the enroll area renders — keep them in sync.
   */
  offeringBoxes: 0 | 1 | 2
  /**
   * The metadata block. Receives the resolved tablet column count so the summary
   * can pass it through to SummaryRows: a half-width metadata cell (the 2-box
   * case) stays linear; otherwise it may split into two tablet columns.
   */
  summary: (opts: { tabletColumns: 1 | 2 }) => React.ReactNode
  enrollArea: React.ReactNode
  /** Optional cross-sell rendered below the grid, inside the card. */
  upsell?: React.ReactNode
  askTim: { readableId: string; resourceType: "course" | "program" }
}

/**
 * Shared InfoBox card shell for the course and program variants: the labelled
 * section, the count-aware offerings grid (metadata cell + optional divider +
 * enroll area), an optional upsell below the grid, and the Ask TIM section
 * beneath the card. Callers own the data and pass the heading, offering-box
 * count, and the pieces to render.
 */
const InfoBoxLayout: React.FC<InfoBoxLayoutProps> = ({
  heading,
  offeringBoxes,
  summary,
  enrollArea,
  upsell,
  askTim,
}) => {
  const boxCount = 1 + offeringBoxes // 1 | 2 | 3
  // A 2-box tablet row puts the metadata in a half-width cell — keep it linear.
  const tabletColumns: 1 | 2 = boxCount === 2 ? 1 : 2

  return (
    <InfoBoxColumn>
      <InfoBoxCard as="section" aria-labelledby={HeadingIds.Summary}>
        <VisuallyHidden>
          <h2 id={HeadingIds.Summary}>{heading}</h2>
        </VisuallyHidden>
        <BoxGrid data-boxes={boxCount}>
          <div data-grid-meta>{summary({ tabletColumns })}</div>
          {offeringBoxes > 0 ? <SectionDivider /> : null}
          {enrollArea}
        </BoxGrid>
        {upsell}
      </InfoBoxCard>
      <ProductPageAskTimSection
        readableId={askTim.readableId}
        resourceType={askTim.resourceType}
      />
    </InfoBoxColumn>
  )
}

export default InfoBoxLayout
