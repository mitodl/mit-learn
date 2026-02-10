import React, { useState, useRef } from "react"
import { NodeViewWrapper } from "@tiptap/react"
import type { ReactNodeViewProps } from "@tiptap/react"
import styled from "@emotion/styled"
import { Container, Avatar } from "ol-components"
import { RiShareFill } from "@remixicon/react"
import { ActionButton } from "@mitodl/smoot-design"
import type { JSONContent } from "@tiptap/core"
import { useUserMe } from "api/hooks/user"
import { useArticle } from "../../../ArticleContext"
import { calculateReadTime } from "../../utils"
import SharePopover from "@/components/SharePopover/SharePopover"

const NEXT_PUBLIC_ORIGIN = process.env.NEXT_PUBLIC_ORIGIN

const StyledWrapper = styled.div(({ theme }) => ({
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

const InnerContainer = styled(Container, {
  shouldForwardProp: (prop) => prop !== "noAuthor",
})<{ noAuthor?: boolean }>(({ noAuthor }) => ({
  display: "flex",
  justifyContent: noAuthor ? "flex-end" : "space-between",
  alignItems: "center",
  "&&": {
    maxWidth: "890px",
  },
}))

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

interface Author {
  first_name?: string | null
  last_name?: string | null
}

interface ArticleByLineInfoBarContentProps {
  author: Author | null
  publishedDate: string | null
  content: JSONContent | null | undefined
  isEditable?: boolean
}

export const ArticleByLineInfoBarContent = ({
  author,
  publishedDate,
  content,
  isEditable = false,
}: ArticleByLineInfoBarContentProps) => {
  const [shareOpen, setShareOpen] = useState(false)
  const shareButtonRef = useRef<HTMLDivElement>(null)

  const article = useArticle()

  const readTime = calculateReadTime(content)

  return (
    <StyledWrapper>
      <SharePopover
        open={shareOpen}
        title={article?.title ?? ""}
        anchorEl={shareButtonRef.current}
        onClose={() => setShareOpen(false)}
        pageUrl={`${NEXT_PUBLIC_ORIGIN}/articles/${article?.slug}`}
      />
      <InnerContainer noAuthor={!author}>
        {author && (
          <InfoContainer>
            <Avatar>
              {author.first_name?.charAt(0) || ""}
              {author.last_name?.charAt(0) || ""}
            </Avatar>
            <NameText>
              By {author.first_name} {author.last_name}
            </NameText>
            {readTime ? <InfoText>{readTime} min read</InfoText> : null}
            {readTime && publishedDate ? <InfoText>-</InfoText> : null}
            <InfoText>
              {publishedDate
                ? new Date(publishedDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : isEditable
                  ? null
                  : "Draft"}
            </InfoText>
          </InfoContainer>
        )}
        <div ref={shareButtonRef}>
          <ActionButton
            size="small"
            variant="bordered"
            edge="circular"
            aria-label="Share this article"
            onClick={() => setShareOpen(true)}
          >
            <RiShareFill />
          </ActionButton>
        </div>
      </InnerContainer>
    </StyledWrapper>
  )
}

const ArticleByLineInfoBar = ({ editor }: ReactNodeViewProps) => {
  const article = useArticle()
  const { data: user } = useUserMe()

  const author =
    (editor?.isEditable && !article?.user ? user : article?.user) ?? null

  const publishedDate = article?.is_published ? article?.created_on : null

  const content = editor?.isEditable ? editor?.getJSON() : article?.content

  return (
    <NodeViewWrapper>
      <ArticleByLineInfoBarContent
        author={author}
        publishedDate={publishedDate}
        content={content}
        isEditable={editor?.isEditable}
      />
    </NodeViewWrapper>
  )
}

export default ArticleByLineInfoBar
