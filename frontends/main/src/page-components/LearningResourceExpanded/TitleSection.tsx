import React from "react"
import styled from "@emotion/styled"
import { Skeleton, theme, Typography } from "ol-components"
import { ActionButton } from "@mitodl/smoot-design"
import type { LearningResource } from "api"
import { getReadableResourceType } from "ol-utilities"
import { RiCloseLargeLine } from "@remixicon/react"

const TitleContainer = styled.div({
  display: "flex",
  position: "sticky",
  justifyContent: "space-between",
  top: "0",
  padding: "24px 28px",
  gap: "16px",
  zIndex: 1,
  backgroundColor: theme.custom.colors.white,
  [theme.breakpoints.down("md")]: {
    padding: "24px 16px",
  },
})

const CloseButton = styled(ActionButton)(({ theme }) => ({
  "&&&": {
    flexShrink: 0,
    backgroundColor: theme.custom.colors.lightGray2,
    color: theme.custom.colors.black,
    ["&:hover"]: {
      backgroundColor: theme.custom.colors.red,
      color: theme.custom.colors.white,
    },
  },
}))

const CloseIcon = styled(RiCloseLargeLine)`
  &&& {
    width: 18px;
    height: 18px;
  }
`

const TitleSection: React.FC<{
  titleId?: string
  resource?: LearningResource
  closeDrawer: () => void
}> = ({ resource, closeDrawer, titleId }) => {
  const closeButton = (
    <CloseButton
      variant="text"
      size="medium"
      onClick={() => closeDrawer()}
      aria-label="Close"
    >
      <CloseIcon />
    </CloseButton>
  )

  const type = resource ? (
    getReadableResourceType(resource.resource_type)
  ) : (
    <Skeleton variant="text" width="33%" />
  )
  const title = resource ? (
    resource.title
  ) : (
    <Skeleton
      // Ideally the resource data is loaded before the drawer opens, e.g., by
      // a server prefetch or by setQueryData in a parent component.
      // This is a fallback.
      aria-label="Resource Details Loading"
      variant="text"
      height={20}
      width="80%"
    />
  )

  return (
    <TitleContainer>
      <Typography
        variant="h4"
        id={titleId}
        width="100%"
        color={theme.custom.colors.darkGray2}
      >
        <Typography
          variant="subtitle2"
          color={theme.custom.colors.silverGrayDark}
        >
          {type}
        </Typography>
        {title}
      </Typography>
      {closeButton}
    </TitleContainer>
  )
}

export default TitleSection
