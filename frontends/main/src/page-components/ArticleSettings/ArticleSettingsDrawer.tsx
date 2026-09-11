"use client"

import React, { useEffect, useMemo, useState } from "react"
import styled from "@emotion/styled"
import {
  Drawer,
  Typography,
  SimpleSelectField,
  type SimpleSelectOption,
} from "ol-components"
import { ActionButton, Button, TextField } from "@mitodl/smoot-design"
import { RiCloseLargeLine } from "@remixicon/react"
import { useLearningResourceTopics } from "api/hooks/learningResources"

/**
 * Content settings drawer, drawn from the /articles design but shared by every
 * website content type -- the heading takes the type's label so news reads
 * "News Settings".
 *
 * Topic options come from the live topics API, but the values the drawer
 * collects are **not persisted yet**: WebsiteContent has no `topics`,
 * `seo_title` or `seo_description` field, so there is nothing to PATCH them
 * onto. The drawer therefore owns its values locally and hands them to
 * `onSave`; wiring that to a mutation is a one-line change once those fields
 * exist. See the note on `onSave` below.
 */

/** Drawer width from the design; narrows to the viewport on small screens. */
const DRAWER_WIDTH = 900

const PaperContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  width: DRAWER_WIDTH,
  maxWidth: "100vw",
  minHeight: "100%",
})

const Header = styled.div(({ theme }) => ({
  position: "sticky",
  top: 0,
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  gap: "24px",
  padding: "24px 32px",
  backgroundColor: theme.custom.colors.white,
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
}))

/* A plain wrapper: styled(Typography) would drop its polymorphic `component`. */
const HeaderTitle = styled.div({
  flex: 1,
  minWidth: 0,
})

/* The drawer body is gray; the topics section sits on it as a white band. */
const Body = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  flex: 1,
  backgroundColor: theme.custom.colors.lightGray1,
}))

const Section = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
})

const TopicsSection = styled(Section)(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  padding: "24px 40px 40px",
}))

const SeoSection = styled(Section)({
  padding: "40px",
})

const SectionHeading = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
})

/* Selects grow; "Add" keeps its intrinsic width and aligns to their inputs. */
const TopicRow = styled.div({
  display: "flex",
  alignItems: "flex-end",
  gap: "16px",
})

const GrowingSelect = styled(SimpleSelectField)({
  flex: 1,
  minWidth: 0,
})

const SelectedTopics = styled.ul({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  margin: 0,
  padding: 0,
  listStyle: "none",
})

const SelectedTopic = styled.li(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "4px",
  padding: "4px 4px 4px 12px",
  borderRadius: "4px",
  backgroundColor: theme.custom.colors.lightGray2,
  color: theme.custom.colors.darkGray2,
  ...theme.typography.body3,
}))

const FooterCta = styled.div({
  display: "flex",
  justifyContent: "flex-end",
  gap: "16px",
  padding: "40px",
  marginTop: "auto",
})

/** Settings the drawer collects. Mirrors the fields in the design. */
export interface ArticleSettingsValues {
  /** Topic ids, innermost selection per row (subtopic when one was chosen). */
  topicIds: number[]
  seoTitle: string
  seoDescription: string
}

const EMPTY_SETTINGS: ArticleSettingsValues = {
  topicIds: [],
  seoTitle: "",
  seoDescription: "",
}

export interface ArticleSettingsDrawerProps {
  open: boolean
  onClose: () => void
  /**
   * Display label for the content type being edited ("Article", "News"), used
   * in the heading and the section copy.
   */
  contentLabel?: string
  /** Values to open with. Re-read each time the drawer opens. */
  initialValues?: Partial<ArticleSettingsValues>
  /**
   * Called with the collected settings when "Save Settings" is pressed.
   *
   * Deliberately a callback rather than a mutation: the backend fields do not
   * exist yet, so there is no endpoint to call. When they land, the caller
   * passes a handler that PATCHes them and this component does not change.
   */
  onSave?: (values: ArticleSettingsValues) => void
}

const ArticleSettingsDrawer = ({
  open,
  onClose,
  contentLabel = "Article",
  initialValues,
  onSave,
}: ArticleSettingsDrawerProps) => {
  const [topicId, setTopicId] = useState("")
  const [subtopicId, setSubtopicId] = useState("")
  const [topicIds, setTopicIds] = useState<number[]>([])
  const [seoTitle, setSeoTitle] = useState("")
  const [seoDescription, setSeoDescription] = useState("")

  /**
   * Two narrow queries using the endpoint's own filters rather than one broad
   * fetch filtered client-side. `parent_topic_id` matters beyond tidiness: a
   * subtopic is reachable even when its parent is absent from the response,
   * which `/api/v1/topics/` does whenever the parent's topic channel is
   * unpublished (the endpoint drops any topic with a null `channel_url`).
   * React Query caches each parent's children, so re-picking is free.
   */
  const { data: topicsData, isLoading: topicsLoading } =
    useLearningResourceTopics(
      { is_toplevel: true, limit: 100 },
      { enabled: open },
    )
  const { data: subtopicsData } = useLearningResourceTopics(
    { parent_topic_id: [Number(topicId)], limit: 100 },
    { enabled: open && !!topicId },
  )

  const mainTopics = useMemo(() => topicsData?.results ?? [], [topicsData])
  const subtopics = useMemo(() => subtopicsData?.results ?? [], [subtopicsData])

  // Reset to the caller's values each time the drawer opens, so a cancelled
  // edit does not leak into the next open.
  useEffect(() => {
    if (!open) return
    const values = { ...EMPTY_SETTINGS, ...initialValues }
    setTopicIds(values.topicIds)
    setSeoTitle(values.seoTitle)
    setSeoDescription(values.seoDescription)
    setTopicId("")
    setSubtopicId("")
    // initialValues is a fresh object on most renders; keying off `open` is
    // what we want here -- reset on open, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const topicOptions = useMemo<SimpleSelectOption[]>(
    () => [
      {
        value: "",
        label: topicsLoading
          ? "Loading topics…"
          : mainTopics.length
            ? "Select main topic"
            : "No topics available",
        disabled: true,
      },
      ...mainTopics.map((topic) => ({
        value: String(topic.id),
        label: topic.name,
      })),
    ],
    [mainTopics, topicsLoading],
  )

  const subtopicOptions = useMemo<SimpleSelectOption[]>(
    () => [
      {
        value: "",
        label: !topicId
          ? "Select a topic first"
          : subtopics.length
            ? "Select subtopic"
            : "No subtopics",
        disabled: true,
      },
      ...subtopics.map((topic) => ({
        value: String(topic.id),
        label: topic.name,
      })),
    ],
    [subtopics, topicId],
  )

  /**
   * Names accumulate as lists load rather than being derived from the current
   * ones, so an added chip keeps its label after the subtopic list it came
   * from has been replaced by a different parent's children.
   */
  const [topicNames, setTopicNames] = useState<Map<number, string>>(new Map())
  useEffect(() => {
    const loaded = [...mainTopics, ...subtopics]
    if (!loaded.length) return
    setTopicNames((current) => {
      const next = new Map(current)
      let changed = false
      for (const topic of loaded) {
        if (next.get(topic.id) !== topic.name) {
          next.set(topic.id, topic.name)
          changed = true
        }
      }
      // Same reference when nothing is new, so this cannot loop.
      return changed ? next : current
    })
  }, [mainTopics, subtopics])

  // The subtopic is the more specific choice, so it wins when both are set.
  const pendingTopicId = Number(subtopicId || topicId)
  const canAdd = !!pendingTopicId && !topicIds.includes(pendingTopicId)

  const handleAdd = () => {
    if (!canAdd) return
    setTopicIds((current) => [...current, pendingTopicId])
    setTopicId("")
    setSubtopicId("")
  }

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <PaperContainer>
        <Header>
          <HeaderTitle>
            <Typography variant="h4" component="h2">
              {contentLabel} Settings
            </Typography>
          </HeaderTitle>
          <ActionButton
            variant="tertiary"
            size="medium"
            onClick={onClose}
            aria-label={`Close ${contentLabel.toLowerCase()} settings`}
          >
            <RiCloseLargeLine />
          </ActionButton>
        </Header>

        <Body>
          <TopicsSection>
            <SectionHeading>
              <Typography variant="h5" component="h3">
                Select Topics
              </Typography>
              <Typography variant="body2">
                Select one or more topics for your {contentLabel.toLowerCase()}
              </Typography>
            </SectionHeading>
            <TopicRow>
              <GrowingSelect
                name="topic"
                label="Topic"
                fullWidth
                options={topicOptions}
                value={topicId}
                onChange={(event) => {
                  setTopicId(event.target.value as string)
                  // The old subtopic belongs to the old parent.
                  setSubtopicId("")
                }}
              />
              <GrowingSelect
                name="subtopic"
                label="Subtopic"
                fullWidth
                options={subtopicOptions}
                value={subtopicId}
                onChange={(event) =>
                  setSubtopicId(event.target.value as string)
                }
              />
              <Button variant="bordered" disabled={!canAdd} onClick={handleAdd}>
                Add
              </Button>
            </TopicRow>
            {topicIds.length > 0 ? (
              <SelectedTopics>
                {topicIds.map((id) => (
                  <SelectedTopic key={id}>
                    {topicNames.get(id) ?? `Topic ${id}`}
                    <ActionButton
                      variant="text"
                      size="small"
                      onClick={() =>
                        setTopicIds((current) =>
                          current.filter((current_) => current_ !== id),
                        )
                      }
                      aria-label={`Remove ${topicNames.get(id) ?? "topic"}`}
                    >
                      <RiCloseLargeLine />
                    </ActionButton>
                  </SelectedTopic>
                ))}
              </SelectedTopics>
            ) : null}
          </TopicsSection>

          <SeoSection>
            <SectionHeading>
              <Typography variant="h5" component="h3">
                SEO Settings
              </Typography>
              <Typography variant="body2">
                Add an SEO title and description to help search engines
                understand and display your {contentLabel.toLowerCase()}.
              </Typography>
            </SectionHeading>
            <TextField
              name="seo_title"
              label="SEO Title"
              fullWidth
              placeholder="Enter a title for search results"
              value={seoTitle}
              onChange={(event) => setSeoTitle(event.target.value)}
            />
            <TextField
              name="seo_description"
              label="SEO Description"
              fullWidth
              multiline
              minRows={9}
              placeholder={`Write a short description that summarizes your ${contentLabel.toLowerCase()} for search results.`}
              value={seoDescription}
              onChange={(event) => setSeoDescription(event.target.value)}
            />
          </SeoSection>

          <FooterCta>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onSave?.({ topicIds, seoTitle, seoDescription })
                onClose()
              }}
            >
              Save Settings
            </Button>
          </FooterCta>
        </Body>
      </PaperContainer>
    </Drawer>
  )
}

export { ArticleSettingsDrawer }
