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
import { env } from "@/env"

/**
 * Content settings drawer, drawn from the /articles design but shared by every
 * website content type -- the heading takes the type's label so news reads
 * "News Settings".
 *
 * Topic options come from the live topics API, and the topics the editor picks
 * are handed to `onSave` as the ids `WebsiteContent.topics` stores.
 *
 * The SEO values are handed over the same way, and `WebsiteContent` now
 * stores both -- for news as well as articles, since a link preview or a
 * search result is the editor's to write on either.
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

/**
 * What `WebsiteContent.seo_title_override` holds -- a
 * `CharField(max_length=255)`.
 *
 * Enforced here rather than left to the server: the drawer's save is fired and
 * forgotten, so a rejected PATCH surfaces only as the editor's generic error
 * banner, with nothing to say which field was too long or by how much.
 */
const SEO_TITLE_MAX = 255

/**
 * What MIT's SEO rules ask of the tags these fields become: a title tag of
 * 50-60 characters, and a description of 160 -- 120 on a phone, so whatever
 * matters goes at the front either way.
 *
 * Guidance, not a limit. Both numbers stand in for pixel widths that a
 * character count only approximates, and a tag a little over is truncated by
 * the search engine rather than rejected -- so going past these is the
 * editor's call to make, and worth telling them about rather than preventing.
 * `SEO_TITLE_MAX` above is the one hard stop, because that one really fails.
 */
const SEO_TITLE_TAG_BUDGET = 60
const SEO_DESCRIPTION_BUDGET = 160

const Counter = styled.div<{ overBudget: boolean }>(
  ({ theme, overBudget }) => ({
    ...theme.typography.body3,
    color: overBudget
      ? theme.custom.colors.mitRed
      : theme.custom.colors.silverGrayDark,
    textAlign: "right",
  }),
)

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

/**
 * What the topics section says about itself, which depends on which rule is
 * speaking: content already public that cannot be left without them, content
 * that only needs them before it goes public, or neither.
 *
 * Keyed on `published` rather than on whether the save is refused: the two no
 * longer coincide -- a draft's save is refused too while a publish is waiting
 * on the drawer -- and telling a draft it is published would be simply wrong.
 */
const topicsMessage = (
  contentLabel: string,
  empty: boolean,
  required: boolean,
  published: boolean,
) => {
  const noun = contentLabel.toLowerCase()
  if (empty && published) {
    return `A published ${noun} needs at least one topic`
  }
  if (empty && required) {
    return `Select at least one topic to publish your ${noun}`
  }
  return `Select one or more topics for your ${noun}`
}

/**
 * What the SEO section says about itself.
 *
 * "Missing" here means the resolved value is empty -- no override and nothing
 * in the content to infer from -- not merely that the field is blank. A blank
 * field is the ordinary case and says so: the content's own words are used.
 *
 * Which one is missing is the whole message where something is: the two
 * resolve separately, so most often only one of them is holding the publish
 * back, and the fields mark only that one required. Naming both would send
 * the author to a field that is already fine, and the invitation to leave
 * them blank is the opposite of the advice they need -- blank is exactly what
 * is blocking them, because the thing it would fall back to is what the
 * content does not have.
 */
const seoMessage = (
  contentLabel: string,
  missing: { title: boolean; description: boolean },
  required: boolean,
  published: boolean,
) => {
  const noun = contentLabel.toLowerCase()
  if (!missing.title && !missing.description) {
    return `Override what search engines and link previews show for your ${noun}. Left blank, each one follows your ${noun} -- the title, and the line under the headline.`
  }
  const both = missing.title && missing.description
  const what = both
    ? "an SEO title and description"
    : missing.title
      ? "an SEO title"
      : "an SEO description"
  const because = both
    ? `Your ${noun} has neither a title nor a line under the headline to fall back to.`
    : missing.title
      ? `Your ${noun} has no title to fall back to.`
      : `Your ${noun} has no line under the headline to fall back to.`
  if (published) {
    return `A published ${noun} needs ${what}. ${because}`
  }
  if (required) {
    return `Add ${what} to publish your ${noun}. ${because}`
  }
  return `Override what search engines and link previews show for your ${noun}. ${because}`
}

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
  /**
   * Whether the content needs at least one topic.
   *
   * The section says so while none is picked -- which is what tells an editor
   * why the drawer opened on them when they pressed Publish -- and the save is
   * refused until one is. Refused rather than merely announced because this
   * drawer is the one place a selection can be taken away, and because a
   * caller holding a publish back is waiting on this save: letting it through
   * incomplete would close the drawer and forget the press.
   */
  topicsRequired?: boolean
  /**
   * Whether the content needs an SEO title and description, on exactly the
   * same terms as `topicsRequired`.
   *
   * Unlike topics this is not an article-only rule: a search result and a link
   * preview are the editor's to write on news just as much.
   */
  seoRequired?: boolean
  /**
   * What each field resolves to when its override is blank, shown as the
   * placeholder so the editor can see what will be used without typing it.
   *
   * Passed in rather than derived here because the editor has the live
   * document: the title being typed into the banner right now, not the one the
   * server last saw. Blank when the content has nothing to infer from -- an
   * untitled draft, or a body with no subheading -- and the generic prompt is
   * shown instead.
   */
  inferredSeoTitle?: string
  inferredSeoDescription?: string
  /**
   * Whether the content is already public, which is only a matter of wording:
   * which sentence a section shows when something it needs is missing. What is
   * required, and what the save refuses, does not depend on it.
   */
  contentIsPublished?: boolean
  /**
   * Whether the save is refused while anything required does not resolve.
   *
   * Separate from `topicsRequired` / `seoRequired`, which say what publishing
   * needs: a draft can be filled in a piece at a time -- topics now, a
   * description later -- and refusing the save until it is complete makes that
   * impossible. So this is true once the content is public, and while a
   * publish is waiting on this drawer, and false for a draft the editor simply
   * opened.
   *
   * The publish-waiting case is what stops that press being dropped: saving
   * closes the drawer, and closing forgets the press, so a save that left the
   * requirement unmet would lose the publish with nothing on screen to say so.
   */
  mustResolve?: boolean
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
  topicsRequired = false,
  seoRequired = false,
  inferredSeoTitle = "",
  inferredSeoDescription = "",
  contentIsPublished = false,
  mustResolve = false,
  initialValues,
  onSave,
}: ArticleSettingsDrawerProps) => {
  const [topicId, setTopicId] = useState("")
  const [subtopicId, setSubtopicId] = useState("")
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [seoTitle, setSeoTitle] = useState("")
  const [seoDescription, setSeoDescription] = useState("")

  /**
   * The budget for this field, which is not the budget for the tag: the page
   * appends " | <site name>" to whatever is entered here -- see
   * `standardizeMetadata` -- and the guidance is about the tag that reaches
   * search results, so the suffix comes out of the allowance.
   *
   * Read here rather than at module scope, where NEXT_PUBLIC_* values are not
   * set yet. Missing, there is no suffix to reserve for.
   */
  /**
   * What each field will actually produce: the override when there is one,
   * otherwise whatever the content infers. This is what the counters measure
   * and what the save is judged on -- a blank field is the ordinary case, not
   * a missing value, so gating on the field itself would refuse every save
   * that simply let the content speak for itself.
   *
   * Whitespace does not count as provided: a space would satisfy a bare
   * emptiness check and reach the page head as a blank title, which is worse
   * than the inference it displaced.
   */
  const resolvedSeoTitle = seoTitle.trim() || inferredSeoTitle.trim()
  const resolvedSeoDescription =
    seoDescription.trim() || inferredSeoDescription.trim()
  const seoMissing = !resolvedSeoTitle || !resolvedSeoDescription

  const siteName = env("NEXT_PUBLIC_SITE_NAME")
  const titleSuffix = siteName ? ` | ${siteName}` : ""
  const seoTitleBudget = SEO_TITLE_TAG_BUDGET - titleSuffix.length
  /* The suffix is named because it is what makes the budget below smaller
     than the 60 the rules quote, which would otherwise look like an error. */
  const seoTitleHelpText = [
    `Aim for ${seoTitleBudget} characters or fewer.`,
    titleSuffix
      ? `"${titleSuffix}" is appended, for a ${SEO_TITLE_TAG_BUDGET}-character title in search results.`
      : "",
    "Lead with the words someone would search for.",
  ]
    .filter(Boolean)
    .join(" ")

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
                  {topicsMessage(
                    contentLabel,
                    selectedIds.length === 0,
                    topicsRequired,
                    contentIsPublished,
                  )}
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
                {seoMessage(
                  contentLabel,
                  {
                    title: !resolvedSeoTitle,
                    description: !resolvedSeoDescription,
                  },
                  seoRequired,
                  contentIsPublished,
                )}
              </Typography>
            </SectionHeading>
            <div>
              <TextField
                name="seo_title"
                label="SEO Title"
                fullWidth
                /* Required only where nothing can stand in for it. Blank is
                   valid -- and the ordinary case -- whenever the content has a
                   title, so marking it required then would put an asterisk and
                   `aria-required` on a field the save is perfectly happy with. */
                required={mustResolve && seoRequired && !inferredSeoTitle}
                /* What will be used if this is left alone. Only a prompt when
                   there is nothing to infer from yet. */
                placeholder={
                  inferredSeoTitle || "Enter a title for search results"
                }
                /* The budget belongs in the description, not only in the
                   counter: otherwise it is discoverable only by being run
                   past. */
                helpText={seoTitleHelpText}
                inputProps={{ maxLength: SEO_TITLE_MAX }}
                value={seoTitle}
                onChange={(event) => setSeoTitle(event.target.value)}
              />
              {/* Announced only when it settles, so it does not interrupt on
                  every keystroke. */}
              <Counter
                aria-live="polite"
                overBudget={resolvedSeoTitle.length > seoTitleBudget}
                data-over-budget={resolvedSeoTitle.length > seoTitleBudget}
              >
                {/* The resolved value, not the field: what a search result
                    will show is what is worth counting. */}
                {`${resolvedSeoTitle.length} / ${seoTitleBudget} characters`}
              </Counter>
            </div>
            <div>
              <TextField
                name="seo_description"
                label="SEO Description"
                fullWidth
                required={mustResolve && seoRequired && !inferredSeoDescription}
                multiline
                /* Sized to the budget rather than to the space: nine rows read
                   as an invitation to write far more than will ever show. */
                minRows={4}
                placeholder={
                  inferredSeoDescription ||
                  `Write a short description that summarizes your ${contentLabel.toLowerCase()} for search results.`
                }
                helpText={`Aim for ${SEO_DESCRIPTION_BUDGET} characters or fewer. Only about 120 show on a phone, so put what matters first.`}
                value={seoDescription}
                onChange={(event) => setSeoDescription(event.target.value)}
              />
              <Counter
                aria-live="polite"
                overBudget={
                  resolvedSeoDescription.length > SEO_DESCRIPTION_BUDGET
                }
                data-over-budget={
                  resolvedSeoDescription.length > SEO_DESCRIPTION_BUDGET
                }
              >
                {`${resolvedSeoDescription.length} / ${SEO_DESCRIPTION_BUDGET} characters`}
              </Counter>
            </div>
          </SeoSection>

          <FooterCta>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              /**
               * Refused rather than silently ignored -- but only where the
               * content has to be complete. A draft is saveable in pieces:
               * topics now, a description once it is written. What publishing
               * needs is insisted on at the publish, and from then on.
               *
               * The sections above say which one is missing.
               */
              disabled={
                mustResolve &&
                ((topicsRequired && showTopics && selectedIds.length === 0) ||
                  (seoRequired && seoMissing))
              }
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
