import React, { useState } from "react"
import { Popover, Typography, styled, theme } from "ol-components"
import Link from "next/link"
import {
  FACEBOOK_SHARE_BASE_URL,
  TWITTER_SHARE_BASE_URL,
  LINKEDIN_SHARE_BASE_URL,
} from "@/common/urls"
import {
  RiFacebookFill,
  RiTwitterXLine,
  RiLinkedinFill,
  RiLink,
} from "@remixicon/react"
import { Button, Input } from "@mitodl/smoot-design"

const StyledPopover = styled(Popover)({
  width: "648px",
  maxWidth: "calc(100vw - 48px)",
  ".MuiPopper-arrow": {
    display: "none",
  },
})

const Contents = styled.div(({ theme }) => ({
  padding: "8px",
  display: "flex",
  gap: "40px",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    gap: "32px",
  },
}))

const SocialContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const LinkContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  flex: 1,
})

const Heading = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
  fontWeight: theme.typography.fontWeightBold,
}))

const ButtonContainer = styled.div({
  display: "flex",
  alignSelf: "stretch",
  gap: "16px",
  a: {
    height: "18px",
  },
})

const ShareLink = styled(Link)({
  color: theme.custom.colors.silverGrayDark,
  "&:hover": {
    color: theme.custom.colors.lightRed,
  },
})

const LinkControls = styled.div(({ theme }) => ({
  display: "flex",
  gap: "16px",
  input: {
    ...theme.typography.body3,
    color: theme.custom.colors.darkGray2,
    padding: "0 3px",
  },
}))

const RedLinkIcon = styled(RiLink)({
  color: theme.custom.colors.red,
})

const CopyLinkButton = styled(Button)({
  minWidth: "104px",
})

const SharePopover = ({
  open,
  title,
  anchorEl,
  onClose,
  pageUrl,
}: {
  open: boolean
  title: string
  anchorEl: HTMLDivElement | null
  onClose: () => void
  pageUrl: string
}) => {
  const [copyText, setCopyText] = useState("Copy Link")

  return (
    <StyledPopover open={open} onClose={onClose} anchorEl={anchorEl}>
      <Contents>
        <SocialContainer>
          <Heading variant="body2">Share on social</Heading>
          <ButtonContainer>
            <ShareLink
              href={`${FACEBOOK_SHARE_BASE_URL}?u=${encodeURIComponent(pageUrl)}`}
              aria-label="Share on Facebook"
              target="_blank"
            >
              <RiFacebookFill size={18} />
            </ShareLink>
            <ShareLink
              href={`${TWITTER_SHARE_BASE_URL}?text=${encodeURIComponent(title)}&url=${encodeURIComponent(pageUrl)}`}
              aria-label="Share on Twitter"
              target="_blank"
            >
              <RiTwitterXLine size={18} />
            </ShareLink>
            <ShareLink
              href={`${LINKEDIN_SHARE_BASE_URL}?url=${encodeURIComponent(pageUrl)}`}
              aria-label="Share on LinkedIn"
              target="_blank"
            >
              <RiLinkedinFill size={18} />
            </ShareLink>
          </ButtonContainer>
        </SocialContainer>
        <LinkContainer>
          <Heading variant="body2">Share a link</Heading>
          <LinkControls>
            <Input
              fullWidth
              value={pageUrl}
              size="small"
              onClick={(event) => {
                const input = event.currentTarget.querySelector("input")
                if (!input) return
                input.select()
              }}
            />
            <CopyLinkButton
              size="small"
              edge="circular"
              variant="bordered"
              startIcon={<RedLinkIcon />}
              onClick={() => {
                navigator.clipboard?.writeText(pageUrl)
                setCopyText("Copied!")
              }}
            >
              {copyText}
            </CopyLinkButton>
          </LinkControls>
        </LinkContainer>
      </Contents>
    </StyledPopover>
  )
}

export default SharePopover
