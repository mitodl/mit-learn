"use client"

import React from "react"
import { Skeleton, styled } from "ol-components"
import type { Theme } from "ol-components"
import type { ContentEngagementDepth } from "api/analytics-hooks/organizations"
import {
  CellText,
  EmptyTableMessage,
  MobileLabel,
  TableCard,
  TableCell,
  TableHeaderCell,
  TableHeaderRow,
  TableRow,
} from "@/components/B2BTable/B2BTable"
import {
  formatAverage,
  formatCount,
  formatPercent,
  SuppressibleValue,
} from "./format"
import SectionError from "./SectionError"

/**
 * All-time content engagement per course run, from
 * `mv_b2b_content_engagement_depth`.
 *
 * # Why there is no chart here
 *
 * The view carries two kinds of number that cannot share a y-axis: counts of
 * *people* (enrolled, engaged, chatbot users, certificates) and counts of
 * *events* (videos watched, problems attempted, chatbot interactions), which
 * run three or four orders of magnitude larger. That is the same reason the
 * event totals were kept off `EngagementTrendChart` — see the axis note there.
 * Plotting them together needs a dual axis, which invites exactly the
 * comparison the scales do not support, and splitting them into two charts
 * would say less than the columns below already do. So this section is a
 * table.
 *
 * # Two numbers per cell
 *
 * Thirteen metrics will not fit as thirteen columns at this table's density.
 * Each activity column therefore leads with the rate — the figure that is
 * comparable across course runs of different sizes — and prints the raw total
 * under it, rather than dropping either.
 *
 * The total is printed with the cohort that produced it ("22 learners, 800
 * watched"), not alone. A bare activity total invites the reader to divide it
 * by the learners they can see, which is the wrong denominator: only the
 * learners who did that particular thing contributed to it, and that is a
 * narrower group than `engaged_learners`. It is also the group the anonymity
 * floor is applied to, so showing it is what makes a suppressed total legible
 * rather than arbitrary.
 *
 * Every metric except `total_enrolled_learners` is nullable under the
 * k-anonymity floor, and each figure in a cell is suppressed on its own, so
 * every one of them goes through `SuppressibleValue`. A suppressed number is
 * never a zero.
 *
 * # Denominators
 *
 * Read off `mv_b2b_content_engagement_depth.sql` in ol-data-platform, not
 * guessed from the field names — the two families do not share a base:
 *
 *  - `engagement_rate_pct` and `chatbot_adoption_pct` divide by
 *    `total_enrolled_learners`, which is why the engaged cell says
 *    "of enrolled".
 *  - `avg_videos_per_engaged_learner` and `avg_problems_per_engaged_learner`
 *    divide by `engaged_learners`, so their columns must say "per engaged
 *    learner". "Per learner" would read as per *enrolled* learner and quietly
 *    overstate the figure on any run where engagement is weak.
 */

/**
 * Every line of text in this table wraps (see `CellText`). Truncating is not an
 * option here: the columns take fixed shares of `TableGrid`'s floor, which
 * leaves an activity column under 100px, while a detail line like
 * "96 learners, 9,134 attempted" needs closer to 200px — so an ellipsis would
 * cut the second figure of every paired cell on every row, at every width.
 */
const CourseTitle = styled(CellText)(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.darkGray2,
}))

/** `overflow-wrap` because a readable id has no spaces to break on. */
const CourseId = styled(CellText)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
  overflowWrap: "anywhere",
}))

/** The secondary figure in an activity cell: the raw total under its rate. */
const Detail = styled(CellText)(({ theme }) => ({
  ...theme.typography.body3,
  color: theme.custom.colors.silverGrayDark,
}))

/**
 * The scroll container for the grid below, and the reason it carries a tab stop
 * and a name: nothing inside the table is focusable, so without them a
 * keyboard-only user would have no route to any column the grid's floor pushes
 * out of view.
 *
 * Focusable unconditionally rather than only when it overflows. Whether it
 * overflows is a question about layout, which means measurement, and a tab stop
 * that appears and disappears as the window resizes is worse than one extra
 * stop at the widths where nothing is hidden.
 */
const TableScroll = styled.div(({ theme }) => ({
  overflowX: "auto",
  [theme.breakpoints.down("md")]: {
    overflowX: "visible",
  },
}))

/**
 * The floor at which seven columns stay legible, and no wider.
 *
 * It is deliberately not the width the columns would *like*: the dashboard's
 * content column is a 1200px container less the 300px sidebar and its gap, so
 * it tops out at 874px however wide the screen is — 1920px included. A grid
 * sized for comfort therefore buys nothing but permanent horizontal scrolling.
 * At 840px every column renders in full; the two "per engaged learner" headers
 * wrap to three lines and rows grow by ~18px, which is the whole cost of never
 * scrolling on a normal desktop.
 *
 * Below `md` the rows stack (see `StackedCell`), so the floor lifts: a phone
 * gets label/value pairs, not an 840px grid three screens wide.
 */
const TableGrid = styled.div(({ theme }) => ({
  minWidth: "840px",
  [theme.breakpoints.down("md")]: {
    minWidth: "0",
  },
}))

/**
 * Every cell here carries two lines of value, which the shared cell's stacked
 * layout is not built for: it sets the label beside the value, and a label as
 * long as "Problems per engaged learner" leaves so little room that
 * "96 learners, 9,134 attempted" breaks across four lines. Once stacked, the
 * label therefore sits above its value rather than beside it, giving the pair
 * the full width of the row. Applied to every labelled cell in the table, not
 * only the two-line ones, so the column of labels stays straight.
 */
const StackedCell = styled(TableCell)(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "2px",
  },
}))

/**
 * The course column stays put while the rest of the row scrolls, which it does
 * whenever the window leaves the grid less than its 840px floor. Without this,
 * scrolling the right-hand columns into view costs the reader the only thing
 * that said which course run the numbers belong to.
 *
 * Opaque on purpose, header and body alike: a sticky cell paints over the
 * columns passing behind it, and a transparent one would let them show through.
 *
 * `align-self` is what makes that mask whole. Both rows centre their cells, so
 * a sticky cell is only as tall as its own text — one line of "Course" against
 * a three-line header leaves a gap above and below through which the scrolled
 * header's first and last lines reappear, its middle line alone hidden. The
 * cell therefore stretches to the row and centres its own text inside.
 */
const stickyColumn = (theme: Theme) => ({
  [theme.breakpoints.up("md")]: {
    position: "sticky" as const,
    left: 0,
    zIndex: 1,
    alignSelf: "stretch" as const,
    display: "flex",
    alignItems: "center",
    backgroundColor: theme.custom.colors.white,
    borderRight: `1px solid ${theme.custom.colors.lightGray2}`,
    paddingRight: "8px",
  },
})

const CourseHeaderCell = styled(TableHeaderCell)(({ theme }) =>
  stickyColumn(theme),
)

const CourseCell = styled(TableCell)(({ theme }) => stickyColumn(theme))

const COLUMN_FLEX = {
  course: 2.6,
  enrolled: 1,
  engaged: 1.2,
  videos: 1.3,
  problems: 1.3,
  chatbot: 1.4,
  certificates: 1.2,
}

const ContentEngagementTable: React.FC<{
  rows: ContentEngagementDepth[] | undefined
  isLoading: boolean
  isError?: boolean
}> = ({ rows, isLoading, isError }) => {
  if (isError) {
    return (
      <TableCard>
        <SectionError />
      </TableCard>
    )
  }

  if (isLoading) {
    return (
      <TableCard>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            width="100%"
            height="44px"
            style={{ marginBottom: "8px" }}
          />
        ))}
      </TableCard>
    )
  }

  if (!rows?.length) {
    return (
      <TableCard>
        <EmptyTableMessage>
          No content engagement recorded yet.
        </EmptyTableMessage>
      </TableCard>
    )
  }

  return (
    <TableCard>
      <TableScroll
        role="region"
        aria-label="Content engagement, scrollable table"
        tabIndex={0}
      >
        <TableGrid role="table" aria-label="Content engagement">
          <div role="rowgroup">
            <TableHeaderRow role="row">
              <CourseHeaderCell role="columnheader" $flex={COLUMN_FLEX.course}>
                Course
              </CourseHeaderCell>
              <TableHeaderCell
                role="columnheader"
                $flex={COLUMN_FLEX.enrolled}
                $numeric
              >
                Enrolled
              </TableHeaderCell>
              <TableHeaderCell
                role="columnheader"
                $flex={COLUMN_FLEX.engaged}
                $numeric
              >
                Engaged
              </TableHeaderCell>
              <TableHeaderCell
                role="columnheader"
                $flex={COLUMN_FLEX.videos}
                $numeric
              >
                Videos per engaged learner
              </TableHeaderCell>
              <TableHeaderCell
                role="columnheader"
                $flex={COLUMN_FLEX.problems}
                $numeric
              >
                Problems per engaged learner
              </TableHeaderCell>
              <TableHeaderCell
                role="columnheader"
                $flex={COLUMN_FLEX.chatbot}
                $numeric
              >
                Chatbot adoption
              </TableHeaderCell>
              <TableHeaderCell
                role="columnheader"
                $flex={COLUMN_FLEX.certificates}
                $numeric
              >
                Certificates
              </TableHeaderCell>
            </TableHeaderRow>
          </div>
          <div role="rowgroup">
            {rows.map((row) => (
              <TableRow role="row" key={row.courserun_readable_id}>
                <CourseCell role="cell" $flex={COLUMN_FLEX.course} $primary>
                  <span>
                    <CourseTitle>{row.courserun_title}</CourseTitle>
                    <CourseId>{row.courserun_readable_id}</CourseId>
                  </span>
                </CourseCell>
                <StackedCell role="cell" $flex={COLUMN_FLEX.enrolled} $numeric>
                  <MobileLabel>Enrolled</MobileLabel>
                  {formatCount(row.total_enrolled_learners)}
                </StackedCell>
                <StackedCell role="cell" $flex={COLUMN_FLEX.engaged} $numeric>
                  <MobileLabel>Engaged</MobileLabel>
                  <span>
                    <SuppressibleValue value={row.engaged_learners} />
                    <Detail>
                      <SuppressibleValue
                        value={row.engagement_rate_pct}
                        format={formatPercent}
                      />{" "}
                      of enrolled
                    </Detail>
                  </span>
                </StackedCell>
                <StackedCell role="cell" $flex={COLUMN_FLEX.videos} $numeric>
                  <MobileLabel>Videos per engaged learner</MobileLabel>
                  <span>
                    <SuppressibleValue
                      value={row.avg_videos_per_engaged_learner}
                      format={formatAverage}
                    />
                    <Detail>
                      <SuppressibleValue value={row.video_watchers} /> learners,{" "}
                      <SuppressibleValue value={row.total_videos_watched} />{" "}
                      watched
                    </Detail>
                  </span>
                </StackedCell>
                <StackedCell role="cell" $flex={COLUMN_FLEX.problems} $numeric>
                  <MobileLabel>Problems per engaged learner</MobileLabel>
                  <span>
                    <SuppressibleValue
                      value={row.avg_problems_per_engaged_learner}
                      format={formatAverage}
                    />
                    <Detail>
                      <SuppressibleValue value={row.problem_attempters} />{" "}
                      learners,{" "}
                      <SuppressibleValue value={row.total_problems_attempted} />{" "}
                      attempted
                    </Detail>
                  </span>
                </StackedCell>
                <StackedCell role="cell" $flex={COLUMN_FLEX.chatbot} $numeric>
                  <MobileLabel>Chatbot adoption</MobileLabel>
                  <span>
                    <SuppressibleValue
                      value={row.chatbot_adoption_pct}
                      format={formatPercent}
                    />
                    <Detail>
                      <SuppressibleValue value={row.chatbot_users} /> learners,{" "}
                      <SuppressibleValue
                        value={row.total_chatbot_interactions}
                      />{" "}
                      interactions
                    </Detail>
                  </span>
                </StackedCell>
                <StackedCell
                  role="cell"
                  $flex={COLUMN_FLEX.certificates}
                  $numeric
                >
                  <MobileLabel>Certificates</MobileLabel>
                  <SuppressibleValue value={row.certificates_earned} />
                </StackedCell>
              </TableRow>
            ))}
          </div>
        </TableGrid>
      </TableScroll>
    </TableCard>
  )
}

export default ContentEngagementTable
export { COLUMN_FLEX }
