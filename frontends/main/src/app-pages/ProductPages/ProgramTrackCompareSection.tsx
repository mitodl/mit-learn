import React from "react"
import { Skeleton, Typography } from "ol-components"
import { styled } from "@mitodl/smoot-design"
import type {
  CourseWithCourseRunsSerializerV2,
  V2ProgramDetail,
} from "@mitodl/mitxonline-api-axios/v2"
import type { ProgramRequirementSection } from "@/common/mitxonline"
import { HeadingIds, getTrackGroupRuleText } from "./util"
import { keyBy } from "lodash"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import { parseTrackedProgramRequirements } from "@/common/mitxonline"

const CompareRoot = styled.section({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
})

const CompareCard = styled.div(({ theme }) => ({
  borderRadius: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  overflow: "hidden",
}))

const IncludedBox = styled.div(({ theme }) => ({
  padding: "16px",
  backgroundColor: theme.custom.colors.lightGray1,
}))

const IncludedTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle1,
  margin: "0 0 12px",
})) as typeof Typography

const BulletList = styled.ul(({ theme }) => ({
  ...theme.typography.body2,
  margin: 0,
  paddingLeft: "28px",
  // Track rows are list items themselves, so the browser would otherwise
  // render these nested bullets as hollow circles.
  listStyleType: "disc",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  color: theme.custom.colors.darkGray2,
  "li::marker": {
    color: theme.custom.colors.red,
  },
}))

const TrackRows = styled.ul({
  listStyle: "none",
  margin: 0,
  padding: "0 16px",
})

const TrackRow = styled.li(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
  gap: "24px",
  padding: "16px 12px",
  "& + &": {
    borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
  },
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
    gap: "12px",
    padding: "16px 0",
  },
}))

const TrackName = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.red,
  margin: "0 0 8px",
})) as typeof Typography

const TrackDescription = styled.p(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
  margin: 0,
}))

const TrackCourses = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
})

const GroupRule = styled.p(({ theme }) => ({
  ...theme.typography.body2,
  fontWeight: theme.typography.fontWeightMedium,
  margin: 0,
}))

type ProgramTrackCompareSectionProps = {
  program: V2ProgramDetail
  courses?: CourseWithCourseRunsSerializerV2[]
  childPrograms?: V2ProgramDetail[]
  isLoading: boolean
}

/**
 * Side-by-side summary of a tracked program's tracks. Renders nothing for an
 * untracked program or while the program-tracks-product-page flag is off.
 */
const ProgramTrackCompareSection: React.FC<ProgramTrackCompareSectionProps> = ({
  program,
  courses,
  childPrograms,
  isLoading,
}) => {
  const showTracks = useFeatureFlagEnabled(
    FeatureFlags.ProgramTracksProductPage,
  )
  const tracked = parseTrackedProgramRequirements(program.req_tree)
  if (!showTracks || !tracked) return null

  const coursesById = keyBy(courses ?? [], "id")
  const programsById = keyBy(childPrograms ?? [], "id")
  const renderItems = (section: ProgramRequirementSection) =>
    section.items.map((item) => {
      const resource =
        item.type === "course" ? coursesById[item.id] : programsById[item.id]
      if (!resource) {
        return isLoading ? (
          <li key={`${item.type}-${item.id}`}>
            <Skeleton variant="text" width="60%" />
          </li>
        ) : null
      }
      return <li key={`${item.type}-${item.id}`}>{resource.title}</li>
    })

  const sharedSections = [
    ...tracked.sectionsBeforeTracks,
    ...tracked.sectionsAfterTracks,
  ]

  return (
    <CompareRoot aria-labelledby={HeadingIds.TrackCompare}>
      <Typography variant="h4" component="h2" id={HeadingIds.TrackCompare}>
        Compare the tracks
      </Typography>
      <CompareCard>
        {sharedSections.length > 0 ? (
          <IncludedBox>
            <IncludedTitle component="h3">
              Included in every track
            </IncludedTitle>
            <BulletList>{sharedSections.flatMap(renderItems)}</BulletList>
          </IncludedBox>
        ) : null}
        <TrackRows>
          {tracked.tracks.map((track) => (
            <TrackRow key={track.id}>
              <div>
                <TrackName component="h3">{track.title}</TrackName>
                {track.description ? (
                  <TrackDescription>{track.description}</TrackDescription>
                ) : null}
              </div>
              <TrackCourses>
                {track.sections.map((section) => {
                  const rule = getTrackGroupRuleText(section)
                  return (
                    <React.Fragment key={section.id}>
                      {rule ? <GroupRule>{rule}</GroupRule> : null}
                      <BulletList>{renderItems(section)}</BulletList>
                    </React.Fragment>
                  )
                })}
              </TrackCourses>
            </TrackRow>
          ))}
        </TrackRows>
      </CompareCard>
    </CompareRoot>
  )
}

export default ProgramTrackCompareSection
