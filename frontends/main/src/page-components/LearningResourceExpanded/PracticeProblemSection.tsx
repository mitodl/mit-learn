import React from "react"
import styled from "@emotion/styled"
import { Typography } from "ol-components"
import { Alert, Button, ButtonLink } from "@mitodl/smoot-design"
import {
  RiBookmarkFill,
  RiBookmarkLine,
  RiExternalLinkLine,
  RiFilePdf2Line,
} from "@remixicon/react"
import type { DocumentResource } from "api"
import type { LearningResourceCardProps as CardProps } from "ol-components"
import { resourceDrawerSearch } from "@/common/urls"
import ProblemMarkdown from "./ProblemMarkdown"
import { resourceDrawerPushUrl } from "../LearningResourceDrawer/resourceDrawerPushUrl"

const Section = styled.section({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  width: "100%",
})

const Header = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
})

const Eyebrow = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle3,
  color: theme.custom.colors.silverGrayDark,
}))

const Meta = styled.ul(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray1,
  display: "flex",
  flexWrap: "wrap",
  gap: "16px",
  margin: 0,
  padding: 0,
  listStyle: "none",
}))

const Card = styled.div(({ theme }) => ({
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  backgroundColor: theme.custom.colors.white,
  padding: "24px",
  [theme.breakpoints.down("md")]: {
    padding: "16px",
  },
}))

const Parts = styled.ol({
  listStyle: "none",
  margin: 0,
  padding: 0,
})

const Part = styled.li(({ theme }) => ({
  display: "flex",
  gap: "8px",
  paddingTop: "16px",
  marginTop: "16px",
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
}))

const PartLabel = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.red,
  flexShrink: 0,
}))

const PartBody = styled(ProblemMarkdown)({
  flexGrow: 1,
  minWidth: 0,
})

const SourceCard = styled(Card)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
}))

const SourceActions = styled.div({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
})

const FinePrint = styled(Typography)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
}))

type PracticeProblemSectionProps = {
  resource: DocumentResource & {
    practice_problem: NonNullable<DocumentResource["practice_problem"]>
  }
  inUserList?: boolean
  onAddToUserListClick?: CardProps["onAddToUserListClick"]
}

const pagesLabel = (pages: number[]) => {
  if (pages.length === 0) return null
  const first = pages[0]
  const last = pages[pages.length - 1]
  return first === last ? `Page ${first}` : `Pages ${first}–${last}`
}

const partsLabel = (count: number) => {
  if (count === 0) return "1 question"
  return count === 1 ? "1 part" : `${count} parts`
}

/**
 * The drawer's view of a practice problem: its statement and parts rendered
 * from the markdown read from its PDF, and the course and file it is from.
 */
const PracticeProblemSection: React.FC<PracticeProblemSectionProps> = ({
  resource,
  inUserList,
  onAddToUserListClick,
}) => {
  const problem = resource.practice_problem
  const { source } = problem
  const pages = pagesLabel(problem.pages)
  const pdfUrl = source.file_url
    ? `${source.file_url}${problem.pages.length ? `#page=${problem.pages[0]}` : ""}`
    : resource.url
  const eyebrow = [source.course_title, problem.document_title]
    .filter(Boolean)
    .join(" / ")
  const sourceDetails = [
    [source.semester, source.year].filter(Boolean).join(" "),
    [problem.document_title, problem.number && `problem ${problem.number}`]
      .filter(Boolean)
      .join(", "),
    pages,
  ].filter(Boolean)
  const saveLabel = inUserList ? "Saved" : "Save for later"

  return (
    <Section aria-label="Practice problem">
      <Header>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Meta>
          <li>{partsLabel(problem.parts.length)}</li>
          {pages ? <li>{pages}</li> : null}
          {problem.points ? <li>{problem.points} points</li> : null}
          {problem.topics.map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </Meta>
      </Header>
      <Card data-testid="practice-problem-statement">
        {problem.statement ? (
          <ProblemMarkdown>{problem.statement}</ProblemMarkdown>
        ) : null}
        {problem.parts.length ? (
          <Parts>
            {problem.parts.map((part, index) => (
              <Part key={`${part.label}-${index}`}>
                {part.label ? <PartLabel>({part.label})</PartLabel> : null}
                <PartBody>{part.body}</PartBody>
              </Part>
            ))}
          </Parts>
        ) : null}
      </Card>
      <Alert severity="warning">
        Transcribed by AI from the original PDF and not yet reviewed. Check
        equations and figures against the original.
      </Alert>
      <SourceCard>
        <div>
          <Typography variant="subtitle1" component="h3">
            {source.course_title ?? resource.offered_by?.name}
          </Typography>
          {sourceDetails.length ? (
            <Typography variant="body3">{sourceDetails.join(" · ")}</Typography>
          ) : null}
        </div>
        <SourceActions>
          {pdfUrl ? (
            <ButtonLink
              variant="bordered"
              size="small"
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<RiFilePdf2Line />}
            >
              Original PDF
            </ButtonLink>
          ) : null}
          {source.course_id ? (
            <ButtonLink
              variant="secondary"
              size="small"
              href={resourceDrawerSearch(
                source.course_id,
                source.course_title ?? undefined,
              )}
              endIcon={<RiExternalLinkLine />}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey) return
                event.preventDefault()
                window.history.pushState(
                  null,
                  "",
                  resourceDrawerPushUrl({
                    id: source.course_id as number,
                    title: source.course_title ?? "",
                  }),
                )
              }}
            >
              Find this course
            </ButtonLink>
          ) : null}
        </SourceActions>
      </SourceCard>
      <div>
        <Button
          variant="primary"
          startIcon={inUserList ? <RiBookmarkFill /> : <RiBookmarkLine />}
          aria-pressed={!!inUserList}
          onClick={(event) => onAddToUserListClick?.(event, resource.id)}
        >
          {saveLabel}
        </Button>
      </div>
      <FinePrint>
        No solutions are shown. Problem from MIT OpenCourseWare
        {source.course_title ? ` ${source.course_title}` : ""}; see the course
        for its license. Figure descriptions are AI drafts.
      </FinePrint>
    </Section>
  )
}

export default PracticeProblemSection
export type { PracticeProblemSectionProps }
