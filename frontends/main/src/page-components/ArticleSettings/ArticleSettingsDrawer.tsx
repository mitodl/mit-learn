"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import styled from "@emotion/styled"
import {
  Drawer,
  Typography,
  SimpleSelectField,
  type SimpleSelectOption,
} from "ol-components"
import { ActionButton, Button, TextField } from "@mitodl/smoot-design"
import { RiCloseLargeLine, RiCloseLine } from "@remixicon/react"
import { useLearningResourceTopics } from "api/hooks/learningResources"

/**
 * Content settings drawer, drawn from the /articles design but shared by every
 * website content type -- the heading takes the type's label so news reads
 * "News Settings".
 *
 * Topic options come from the live topics API, and the topics the editor picks
 * are handed to `onSave` as the ids `WebsiteContent.topics` stores.
 *
 * The SEO values are still local-only: WebsiteContent has no `seo_title` or
 * `seo_description` field, so there is nothing to PATCH them onto. They ride
 * along in `onSave` so the caller can persist them once those fields exist.
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

/**
 * Selections group under their parent: the topic's name is plain text, and each
 * of its chosen subtopics follows as a removable pill.
 */
const SelectedTopics = styled.ul({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  margin: 0,
  padding: 0,
  listStyle: "none",
})

const SelectedTopicGroup = styled.li({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "16px",
})

const SelectedTopicName = styled.span(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  whiteSpace: "nowrap",
  ...theme.typography.subtitle3,
}))

const SubtopicChip = styled.span(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  height: "32px",
  padding: "0 8px 0 12px",
  /* Fully rounded, unlike the 4px controls above it. */
  borderRadius: "24px",
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.silverGrayLight}`,
  color: theme.custom.colors.silverGrayDark,
  whiteSpace: "nowrap",
  ...theme.typography.subtitle3,
}))

/* 16px icon in a 16px box, per the design -- not the button default of 1em. */
const ChipRemoveButton = styled.button(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  border: "none",
  background: "none",
  cursor: "pointer",
  color: "inherit",
  svg: {
    width: "16px",
    height: "16px",
  },
  ":hover": {
    color: theme.custom.colors.darkGray2,
  },
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
  /**
   * The leaf of each selection -- a subtopic where one was picked, otherwise
   * the topic itself. This is exactly what `WebsiteContent.topics` holds: a
   * subtopic already implies its parent, and the ancestor chain is added
   * downstream when the content becomes a LearningResource, so sending parents
   * as well would be redundant.
   *
   * The design still groups subtopics under their parent, which is derived
   * from each topic's own `parent` rather than stored alongside the id.
   *
   * Absent when `showTopics` is off: the drawer collected no selection, which
   * is not the same as the editor having emptied one.
   */
  topics?: number[]
  seoTitle: string
  seoDescription: string
}

const EMPTY_SETTINGS: ArticleSettingsValues = {
  topics: [],
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
  /**
   * Whether to offer the topics section.
   *
   * The caller decides, since what topics reach is its business: only an
   * article is projected into a LearningResource, so only there do they put
   * the content on a topic page.
   */
  showTopics?: boolean
  /** Values to open with. Re-read each time the drawer opens. */
  initialValues?: Partial<ArticleSettingsValues>
  /**
   * Called with the collected settings when "Save Settings" is pressed.
   *
   * Deliberately a callback rather than a mutation of its own: whether the
   * topics can be PATCHed straight away depends on whether the content has
   * been saved yet, which only the caller knows.
   */
  onSave?: (values: ArticleSettingsValues) => void
}

const ArticleSettingsDrawer = ({
  open,
  onClose,
  contentLabel = "Article",
  showTopics = true,
  initialValues,
  onSave,
}: ArticleSettingsDrawerProps) => {
  const [topicId, setTopicId] = useState("")
  const [subtopicId, setSubtopicId] = useState("")
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [seoTitle, setSeoTitle] = useState("")
  const [seoDescription, setSeoDescription] = useState("")

  /**
   * One fetch of every topic rather than a query per select.
   *
   * Reading saved values back is what forces it: a stored id has to be
   * resolved to a topic to know whether it is a topic or somebody's subtopic,
   * and `/api/v1/topics/` has no id filter to ask about just those. The whole
   * set is small -- ~110 rows against the endpoint's own 1000 limit, which its
   * pagination class exists to allow -- so one cached response serves both
   * selects and the saved-value lookup.
   *
   * Filtering client-side loses nothing the narrower queries had: the endpoint
   * drops any topic with a null `channel_url` (an unpublished topic channel)
   * before its filters run, so `is_toplevel` and `parent_topic_id` were
   * working from this same visible set.
   */
  const { data: topicsData, isLoading: topicsLoading } =
    useLearningResourceTopics({ limit: 1000 }, { enabled: open && showTopics })

  const allTopics = useMemo(() => topicsData?.results ?? [], [topicsData])

  const topicsById = useMemo(
    () => new Map(allTopics.map((topic) => [topic.id, topic])),
    [allTopics],
  )

  const mainTopics = useMemo(
    () => allTopics.filter((topic) => !topic.parent),
    [allTopics],
  )

  const subtopics = useMemo(
    () => allTopics.filter((topic) => topic.parent === Number(topicId)),
    [allTopics, topicId],
  )

  // Reset to the caller's values each time the drawer opens, so a cancelled
  // edit does not leak into the next open. Selections are held as the ids the
  // API takes, so this does not have to wait for the topic list to arrive.
  useEffect(() => {
    if (!open) return
    const values = { ...EMPTY_SETTINGS, ...initialValues }
    /* `topics` is optional, so a caller may pass it explicitly undefined. */
    setSelectedIds(values.topics ?? [])
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

  const pendingTopic = Number(topicId) || null
  const pendingSubtopic = Number(subtopicId) || null

  /**
   * The heading a selected id sits under: its parent when it is a subtopic,
   * otherwise itself. An id whose topic is missing from the response -- the
   * endpoint drops topics whose channel is unpublished, so a selection can
   * outlive its own visibility -- stands on its own rather than disappearing.
   */
  const groupIdFor = useCallback(
    (id: number) => topicsById.get(id)?.parent ?? id,
    [topicsById],
  )

  /**
   * A topic is represented either by a bare entry or by its subtopics, never
   * both. Naming a subtopic already implies its parent, and only subtopics get
   * a chip, so a bare entry alongside one would be invisible yet still ride
   * along into the saved payload.
   *
   * So a bare topic is refused once that topic has subtopics, and adding a
   * subtopic below supersedes the topic's bare entry.
   */
  const pendingGroup = selectedIds.filter(
    (id) => groupIdFor(id) === pendingTopic,
  )
  const alreadyAdded = pendingSubtopic
    ? selectedIds.includes(pendingSubtopic)
    : pendingGroup.length > 0
  const canAdd = !!pendingTopic && !alreadyAdded

  const handleAdd = () => {
    if (!canAdd || !pendingTopic) return
    const added = pendingSubtopic ?? pendingTopic
    setSelectedIds((current) => {
      const bareIndex = current.indexOf(pendingTopic)
      if (bareIndex === -1) return [...current, added]
      // Substituted in place so the group keeps its position in the list.
      const next = [...current]
      next.splice(bareIndex, 1, added)
      return next
    })
    // Keep the topic selected: adding several subtopics under one topic is the
    // common case, and re-picking the parent each time would be tedious.
    setSubtopicId("")
  }

  const handleRemove = (id: number) =>
    setSelectedIds((current) => current.filter((selected) => selected !== id))

  /**
   * Group by parent, preserving the order topics were first added, so the list
   * does not reshuffle as subtopics are added under an existing topic.
   */
  const groupedSelections = useMemo(() => {
    const groups = new Map<number, number[]>()
    for (const id of selectedIds) {
      const groupId = groupIdFor(id)
      const group = groups.get(groupId)
      if (group) group.push(id)
      else groups.set(groupId, [id])
    }
    return [...groups.entries()]
  }, [selectedIds, groupIdFor])

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
          {showTopics ? (
            <TopicsSection>
              <SectionHeading>
                <Typography variant="h5" component="h3">
                  Select Topics
                </Typography>
                <Typography variant="body2">
                  Select one or more topics for your{" "}
                  {contentLabel.toLowerCase()}
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
                <Button
                  variant="bordered"
                  disabled={!canAdd}
                  onClick={handleAdd}
                >
                  Add
                </Button>
              </TopicRow>
              {groupedSelections.length > 0 ? (
                <SelectedTopics aria-label="Selected topics">
                  {groupedSelections.map(([groupTopicId, group]) => {
                    const topicName =
                      topicsById.get(groupTopicId)?.name ??
                      `Topic ${groupTopicId}`
                    return (
                      <SelectedTopicGroup key={groupTopicId}>
                        <SelectedTopicName>{topicName}</SelectedTopicName>
                        {group.map((id) => {
                          /* A topic added without a subtopic has no pill of its
                             own; its name alone represents it. */
                          if (id === groupTopicId) return null
                          const subtopicName =
                            topicsById.get(id)?.name ?? `Subtopic ${id}`
                          return (
                            <SubtopicChip key={id}>
                              {subtopicName}
                              <ChipRemoveButton
                                type="button"
                                onClick={() => handleRemove(id)}
                                aria-label={`Remove ${subtopicName} from ${topicName}`}
                              >
                                <RiCloseLine aria-hidden />
                              </ChipRemoveButton>
                            </SubtopicChip>
                          )
                        })}
                        {group.every((id) => id === groupTopicId) ? (
                          <ChipRemoveButton
                            type="button"
                            onClick={() => handleRemove(groupTopicId)}
                            aria-label={`Remove ${topicName}`}
                          >
                            <RiCloseLine aria-hidden />
                          </ChipRemoveButton>
                        ) : null}
                      </SelectedTopicGroup>
                    )
                  })}
                </SelectedTopics>
              ) : null}
            </TopicsSection>
          ) : null}

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
                onSave?.({
                  /* Undefined rather than [] with the section hidden: the
                     editor cleared nothing, so there is nothing to write. */
                  topics: showTopics ? selectedIds : undefined,
                  seoTitle,
                  seoDescription,
                })
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
