import React, { useState } from "react"
import { Stack, TabContext, TabPanel, Typography } from "ol-components"
import { styled, TabButton, TabButtonList } from "@mitodl/smoot-design"
import { RiArrowDownLine, RiStackLine } from "@remixicon/react"
import type {
  CourseWithCourseRunsSerializerV2,
  V2ProgramDetail,
} from "@mitodl/mitxonline-api-axios/v2"
import type { ProgramTrack } from "@/common/mitxonline"
import RequirementItemCard from "./RequirementItemCard"
import {
  RequirementsListing,
  ReqSubsectionTitle,
  ReqTitleNote,
} from "./RequirementStyles"
import { getRequirementSectionSubtitle, getTrackGroupRuleText } from "./util"

// TabButton drops the className it's given, so the pill styles live on the
// list and target its tab buttons.
const TrackTabList = styled(TabButtonList)(({ theme }) => ({
  marginTop: "24px",
  ".MuiTabs-flexContainer": {
    flexWrap: "wrap",
    gap: "16px",
  },
  "&& button[role=tab]": {
    ...theme.typography.body1,
    height: "48px",
    padding: "0 24px",
    gap: "8px",
    borderRadius: "24px",
    border: "none",
    backgroundColor: theme.custom.colors.lightGray1,
    color: theme.custom.colors.darkGray2,
  },
  "&& button[role=tab]:hover:not([aria-selected=true])": {
    backgroundColor: theme.custom.colors.lightGray2,
  },
  "&& button[role=tab][aria-selected=true]": {
    backgroundColor: theme.custom.colors.red,
    color: theme.custom.colors.white,
    fontWeight: theme.typography.fontWeightMedium,
  },
}))

const TrackPanel = styled(TabPanel)({
  padding: 0,
  marginTop: "32px",
})

const TrackCallout = styled.div(({ theme }) => ({
  ...theme.typography.body1,
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  padding: "24px",
  borderRadius: "8px",
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  backgroundColor: theme.custom.colors.lightGray1,
  color: theme.custom.colors.darkGray2,
}))

const CalloutText = styled.p({
  margin: 0,
})

const TrackRule = styled.p(({ theme }) => ({
  ...theme.typography.body1,
  display: "flex",
  alignItems: "center",
  gap: "12px",
  margin: 0,
  svg: {
    flexShrink: 0,
    width: "24px",
    height: "24px",
  },
}))

const TrackGroupTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle1,
  marginTop: "32px",
})) as typeof Typography

type ProgramTracksSectionProps = {
  tracks: ProgramTrack[]
  coursesById: Record<number, CourseWithCourseRunsSerializerV2>
  programsById: Record<number, V2ProgramDetail>
  isLoading: boolean
}

const ProgramTracksSection: React.FC<ProgramTracksSectionProps> = ({
  tracks,
  coursesById,
  programsById,
  isLoading,
}) => {
  const [selected, setSelected] = useState(String(tracks[0]?.id))

  return (
    <div>
      <ReqSubsectionTitle component="h3">Track courses</ReqSubsectionTitle>
      <Typography variant="body1" component="p">
        Explore the available tracks and the courses included in each to find
        the one that best fits your goals. This is a preview only; you'll choose
        your track after enrollment and can change it later if your needs
        change.
      </Typography>
      <TabContext value={selected}>
        <TrackTabList
          aria-label="Program tracks"
          variant="standard"
          onChange={(_event, value) => setSelected(value)}
        >
          {tracks.map((track) => (
            <TabButton
              key={track.id}
              value={String(track.id)}
              label={
                <>
                  {String(track.id) === selected ? (
                    <RiArrowDownLine aria-hidden="true" />
                  ) : null}
                  {track.title}
                </>
              }
            />
          ))}
        </TrackTabList>
        {tracks.map((track) => {
          const onlySection =
            track.sections.length === 1 ? track.sections[0] : null
          const ruleText = onlySection
            ? getTrackGroupRuleText(onlySection)
            : null
          return (
            <TrackPanel key={track.id} value={String(track.id)}>
              <TrackCallout>
                {track.description ? (
                  <CalloutText>
                    <strong>{track.title}:</strong> {track.description}
                  </CalloutText>
                ) : null}
                {ruleText ? (
                  <TrackRule>
                    <RiStackLine aria-hidden="true" />
                    {ruleText}
                  </TrackRule>
                ) : null}
              </TrackCallout>
              {track.sections.map((section) => {
                const note = onlySection
                  ? null
                  : getRequirementSectionSubtitle(section)
                return (
                  <Stack key={section.id} direction="column">
                    {onlySection ? null : (
                      <TrackGroupTitle component="h4">
                        {section.rawTitle}
                        {note ? ": " : ""}
                        {note ? <ReqTitleNote>{note}</ReqTitleNote> : null}
                      </TrackGroupTitle>
                    )}
                    <RequirementsListing>
                      {section.items.map((item) => (
                        <RequirementItemCard
                          key={`${item.type}-${item.id}`}
                          item={item}
                          coursesById={coursesById}
                          programsById={programsById}
                          isLoading={isLoading}
                          label={track.title}
                        />
                      ))}
                    </RequirementsListing>
                  </Stack>
                )
              })}
            </TrackPanel>
          )
        })}
      </TabContext>
    </div>
  )
}

export default ProgramTracksSection
