import React, { useCallback, useRef, useState } from "react"
import styled from "@emotion/styled"
import { Skeleton, theme, Link } from "ol-components"
import type { LearningResource } from "api"
import { getResourceLanguage } from "ol-utilities"

const DescriptionContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  width: "100%",
})

const Description = styled.p({
  ...theme.typography.body2,
  color: theme.custom.colors.black,
  margin: 0,
  wordBreak: "break-word",
  "> *": {
    ":first-child": {
      marginTop: 0,
    },
    ":last-child": {
      marginBottom: 0,
    },
    ":empty": {
      display: "none",
    },
  },
})

const DescriptionCollapsed = styled(Description)({
  display: "-webkit-box",
  overflow: "hidden",
  maxHeight: `calc(${theme.typography.body2.lineHeight} * 5)`,
  "@supports (-webkit-line-clamp: 5)": {
    maxHeight: "unset",
    WebkitLineClamp: 5,
    WebkitBoxOrient: "vertical",
  },
})

const DescriptionExpanded = styled(Description)({
  display: "block",
})

const ResourceDescription = ({ resource }: { resource?: LearningResource }) => {
  const firstRender = useRef(true)
  const [clampedOnFirstRender, setClampedOnFirstRender] = useState(false)
  const [isClamped, setClamped] = useState(false)
  const [isExpanded, setExpanded] = useState(false)
  const descriptionRendered = useCallback((node: HTMLDivElement) => {
    if (node !== null) {
      const clamped = node.scrollHeight > node.clientHeight
      setClamped(clamped)
      if (firstRender.current) {
        firstRender.current = false
        setClampedOnFirstRender(clamped)
        return
      }
    }
  }, [])
  const DescriptionText = isExpanded
    ? DescriptionExpanded
    : DescriptionCollapsed
  if (!resource) {
    return (
      <>
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="33%" />
      </>
    )
  }
  return (
    <DescriptionContainer data-testid="drawer-description-container">
      <DescriptionText
        data-testid="drawer-description-text"
        ref={descriptionRendered}
        /**
         * Resource descriptions can contain HTML. They are sanitized on the
         * backend during ETL. This is safe to render.
         */
        dangerouslySetInnerHTML={{ __html: resource.description || "" }}
        lang={getResourceLanguage(resource)}
      />
      {(isClamped || clampedOnFirstRender) && (
        <Link
          scroll={false}
          color="red"
          size="small"
          onClick={() => setExpanded(!isExpanded)}
        >
          {isExpanded ? "Show less" : "Show more"}
        </Link>
      )}
    </DescriptionContainer>
  )
}

export default ResourceDescription
