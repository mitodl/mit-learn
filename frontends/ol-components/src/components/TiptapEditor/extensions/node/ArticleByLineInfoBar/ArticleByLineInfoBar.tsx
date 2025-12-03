import React from "react"
import { NodeViewWrapper } from "@tiptap/react"
import type { ReactNodeViewProps } from "@tiptap/react"
import styled from "@emotion/styled"
import Container from "@mui/material/Container"
import { RiShareFill } from "@remixicon/react"
import { useUserMe } from "api/hooks/user"
import Avatar from "@mui/material/Avatar"
import { ActionButton } from "@mitodl/smoot-design"

const StyledNodeViewWrapper = styled(NodeViewWrapper)(({ theme }) => ({
  width: "100vw",
  maxWidth: "100vw",
  position: "relative",
  left: "50%",
  right: "50%",
  marginLeft: "-50vw",
  marginRight: "-50vw",
  marginBottom: "56px",
  background: theme.custom.colors.white,
  padding: "12px 0",
  alignItems: "center",
  justifyContent: "space-between",
  boxShadow: "0 0 5px 0 rgb(0 0 0 / 15%)",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
}))

const InnerContainer = styled(Container)({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  "&&": {
    maxWidth: "890px",
  },
})

const InfoContainer = styled.div({
  display: "flex",
  alignItems: "center",
  gap: "16px",
})

const NameText = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.black,
}))

const InfoText = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
}))

const Spacer = styled.div({
  marginBottom: "56px",
})

const ArticleByLineInfoBar = ({ node }: ReactNodeViewProps) => {
  const { authorName, avatarUrl, readTime, publishedDate, editable } =
    node.attrs
  const { isFetching: isLoadingUser, data: user } = useUserMe()

  if (editable) {
    return <Spacer />
  }

  const author =
    !isLoadingUser && (authorName || `${user?.first_name}  ${user?.last_name}`)
  return (
    <StyledNodeViewWrapper>
      <InnerContainer>
        {author ? (
          <InfoContainer>
            <Avatar
              alt={`${user?.first_name} ${user?.last_name}`}
              src={avatarUrl}
            >
              {user?.first_name?.charAt(0) || ""}
              {user?.last_name?.charAt(0) || ""}
            </Avatar>

            <NameText>
              By {authorName || `${user?.first_name}  ${user?.last_name}`}
            </NameText>
            {readTime && <InfoText>{readTime}</InfoText>}
            <InfoText>-</InfoText>
            <InfoText>
              {publishedDate ? publishedDate : new Date().toLocaleDateString()}
            </InfoText>
          </InfoContainer>
        ) : null}
        <ActionButton
          size="small"
          variant="bordered"
          edge="circular"
          aria-label="Share this article"
        >
          <RiShareFill />
        </ActionButton>
      </InnerContainer>
    </StyledNodeViewWrapper>
  )
}

export default ArticleByLineInfoBar
