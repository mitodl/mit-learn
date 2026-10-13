import React from "react"
import NiceModal from "@ebay/nice-modal-react"
import { Stack, Typography, styled } from "ol-components"
import { Alert, Button } from "@mitodl/smoot-design"
import { RiInformation2Line } from "@remixicon/react"
import { ProgramTrackDialog } from "./ProgramTrackDialog"
import type { ProgramTrackState } from "./model/dashboardViewModel"

const CurrentTrackLabel = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.silverGrayDark,
}))

const CurrentTrackTitle = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.darkGray2,
}))

const TrackButton = styled(Button)(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.red,
  padding: 0,
  minWidth: 0,
}))

const InfoLine = styled(Typography)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "6px",
  color: theme.custom.colors.darkGray1,
  svg: {
    width: "18px",
    height: "18px",
    flexShrink: 0,
  },
}))

const TrackBanner = styled(Alert)({
  marginTop: "8px",
})

const pluralCourses = (count: number) =>
  `${count} ${count === 1 ? "course" : "courses"}`

type ProgramTrackHeaderProps = {
  programId: number
  trackState: ProgramTrackState
}

const ProgramTrackHeader: React.FC<ProgramTrackHeaderProps> = ({
  programId,
  trackState,
}) => {
  const [bannerDismissed, setBannerDismissed] = React.useState(false)
  const {
    tracks,
    currentTrack,
    requiredBeforeTracks,
    beforeTracksComplete,
    requiredPerTrack,
  } = trackState

  const openDialog = () =>
    NiceModal.show(ProgramTrackDialog, { programId, tracks, currentTrack })

  return (
    <Stack direction="column" gap="8px" marginBottom="24px">
      <Stack direction="row" alignItems="center" gap="16px" flexWrap="wrap">
        <span>
          <CurrentTrackLabel>Current track: </CurrentTrackLabel>
          <CurrentTrackTitle>
            {currentTrack?.title ?? "Not selected"}
          </CurrentTrackTitle>
        </span>
        <TrackButton variant="text" size="small" onClick={openDialog}>
          {currentTrack ? "Change track" : "Choose track"}
        </TrackButton>
      </Stack>
      {!currentTrack && !beforeTracksComplete ? (
        <InfoLine variant="body2">
          <RiInformation2Line aria-hidden="true" />
          Choose a track anytime. You won't need to decide until you complete
          your first {pluralCourses(requiredBeforeTracks)}.
        </InfoLine>
      ) : null}
      {!currentTrack && beforeTracksComplete && !bannerDismissed ? (
        <TrackBanner
          severity="info"
          closable
          onClose={() => setBannerDismissed(true)}
        >
          <strong>Choose a track to continue - </strong>
          {/* Tracks of different sizes have no single count to show until
              design settles the copy for them. */}
          {requiredPerTrack === null
            ? "Your track will determine your next required courses."
            : `Your track will determine your next ${requiredPerTrack} required ${requiredPerTrack === 1 ? "course" : "courses"}.`}
        </TrackBanner>
      ) : null}
    </Stack>
  )
}

export { ProgramTrackHeader }
