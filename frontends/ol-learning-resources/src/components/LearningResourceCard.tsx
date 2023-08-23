import React, { useCallback } from "react"
import Dotdotdot from "react-dotdotdot"
import invariant from "tiny-invariant"
import classNames from "classnames"
import type { LearningResource } from "api"

import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import Chip from "@mui/material/Chip"
import CalendarTodayIcon from "@mui/icons-material/CalendarToday"
import DragIndicatorIcon from "@mui/icons-material/DragIndicator"
import CardMedia from "@mui/material/CardMedia"
import moment from "moment"

import { resourceThumbnailSrc, getReadableResourceType } from "../utils"
import type { EmbedlyConfig } from "../utils"

type CardResource = Pick<
  LearningResource,
  | "runs"
  | "certification"
  | "title"
  | "offered_by"
  | "platform"
  | "image"
  | "resource_type"
>

type CardVariant = "column" | "row" | "row-reverse"
type OnActivateCard<R extends CardResource = CardResource> = (
  resource: R
) => void
type LearningResourceCardProps<R extends CardResource = CardResource> = {
  /**
   * Whether the course picture and info display as a column or row.
   */
  variant: CardVariant
  resource: R
  sortable?: boolean
  className?: string
  /**
   * Config used to generate embedly urls.
   */
  imgConfig: EmbedlyConfig
  onActivate?: OnActivateCard<R>
  /**
   * Suppress the image.
   */
  suppressImage?: boolean
  footerActionSlot?: React.ReactNode
}

const CertificateIcon = () => (
  <img
    className="ol-lrc-cert"
    alt="Receive a certificate upon completion"
    src="/static/images/certificate_icon_infinite.png"
  />
)

const CardBody: React.FC<Pick<LearningResourceCardProps, "resource">> = ({
  resource
}) => {
  const offerers = resource.offered_by ?? []
  return offerers.length > 0 ? (
    <div>
      <span className="ol-lrc-offered-by">Offered by &ndash;</span>
      {offerers.join(", ")}
    </div>
  ) : null
}

const ResourceFooterDetails: React.FC<
  Pick<LearningResourceCardProps, "resource">
> = ({ resource }) => {
  const bestRun = resource.runs?.[0]
  const startDate = bestRun?.start_date
  const formattedDate = startDate ?
    moment(startDate).format("MMMM DD, YYYY") :
    null

  if (!startDate) return null

  return (
    <Chip
      className="ol-lrc-chip"
      avatar={<CalendarTodayIcon />}
      label={formattedDate}
    />
  )
}

type LRCImageProps = Pick<
  LearningResourceCardProps,
  "resource" | "imgConfig" | "suppressImage" | "variant"
>
const LRCImage: React.FC<LRCImageProps> = ({
  resource,
  imgConfig,
  suppressImage,
  variant
}) => {
  if (suppressImage) return null
  const dims =
    variant === "column" ?
      { height: imgConfig.height } :
      { width: imgConfig.width, height: imgConfig.height }
  return (
    <CardMedia
      component="img"
      className="ol-lrc-image"
      sx={dims}
      src={resourceThumbnailSrc(resource, imgConfig)}
      alt=""
    />
  )
}

const variantClasses: Record<CardVariant, string> = {
  column:        "ol-lrc-col",
  row:           "ol-lrc-row",
  "row-reverse": "ol-lrc-row-reverse"
}

/**
 * A card display for Learning Resources. Includes a title, image, and various
 * metadata.
 *
 * This template does not provide any meaningful user interaction by itself, but
 * does accept props to build user interaction (e.g., `onActivate` and
 * `footerActionSlot`).
 */
const LearningResourceCard = <R extends CardResource>({
  variant,
  resource,
  imgConfig,
  className,
  suppressImage = false,
  onActivate,
  footerActionSlot,
  sortable
}: LearningResourceCardProps<R>) => {
  const hasCertificate =
    resource.certification && resource.certification.length > 0
  const handleActivate = useCallback(
    () => onActivate?.(resource),
    [resource, onActivate]
  )

  invariant(
    !sortable || variant === "row-reverse",
    "sortable only supported for variant='row-reverse'"
  )

  return (
    <Card className={classNames(className, "ol-lrc-root")}>
      {variant === "column" ? (
        <LRCImage
          variant={variant}
          suppressImage={suppressImage}
          resource={resource}
          imgConfig={imgConfig}
        />
      ) : null}
      <CardContent
        className={classNames("ol-lrc-content", variantClasses[variant], {
          "ol-lrc-sortable": sortable
        })}
      >
        {variant !== "column" ? (
          <LRCImage
            variant={variant}
            suppressImage={suppressImage}
            resource={resource}
            imgConfig={imgConfig}
          />
        ) : null}
        <div className="ol-lrc-details">
          <div className="ol-lrc-type-row">
            <span className="ol-lrc-type">
              {getReadableResourceType(resource)}
            </span>
            {hasCertificate && <CertificateIcon />}
          </div>
          {onActivate ? (
            <button className="clickable-title" onClick={handleActivate}>
              <Dotdotdot className="ol-lrc-title" tagName="h3" clamp={3}>
                {resource.title}
              </Dotdotdot>
            </button>
          ) : (
            <Dotdotdot className="ol-lrc-title" tagName="h3" clamp={3}>
              {resource.title}
            </Dotdotdot>
          )}
          {sortable ? null : (
            <>
              <CardBody resource={resource} />
              <div className="ol-lrc-fill-space-content-end">
                <div className="ol-lrc-footer-row">
                  <div>
                    <ResourceFooterDetails resource={resource} />
                  </div>
                  {footerActionSlot}
                </div>
              </div>
            </>
          )}
        </div>
        {sortable ? (
          <div className="ol-lrc-drag-handle">
            <DragIndicatorIcon fontSize="inherit" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default LearningResourceCard
export type { LearningResourceCardProps }
