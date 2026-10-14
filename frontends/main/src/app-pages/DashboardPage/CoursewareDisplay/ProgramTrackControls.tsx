import React from "react"
import NiceModal from "@ebay/nice-modal-react"
import { styled } from "ol-components"
import { ProgramTrackDialog } from "./ProgramTrackDialog"
import type { ProgramTrackState } from "./model/dashboardViewModel"

const LinkButton = styled.button(({ theme }) => ({
  padding: 0,
  border: "none",
  background: "none",
  cursor: "pointer",
  color: theme.custom.colors.red,
}))

const ChangeTrackButton = styled(LinkButton)(({ theme }) => ({
  ...theme.typography.body2,
  textDecoration: "underline",
}))

const ChooseTrackButton = styled(LinkButton)(({ theme }) => ({
  ...theme.typography.subtitle1,
  fontWeight: theme.typography.fontWeightBold,
}))

const Placeholder = styled.div(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  alignItems: "center",
  gap: "16px",
  padding: "32px",
  border: `1px dashed ${theme.custom.colors.silverGrayLight}`,
  borderRadius: "8px",
  opacity: 0.8,
}))

const CurrentTrackLabel = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.silverGrayDark,
}))

const CurrentTrackTitle = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.custom.colors.darkGray2,
}))

type ProgramTrackControlProps = {
  programId: number
  trackState: ProgramTrackState
}

const useOpenTrackDialog = ({
  programId,
  trackState,
}: ProgramTrackControlProps) => {
  const { tracks, currentTrack } = trackState
  return () =>
    NiceModal.show(ProgramTrackDialog, { programId, tracks, currentTrack })
}

/**
 * Stands in for the track's sections until the learner's chosen track has
 * courses to show.
 */
const ProgramTrackPlaceholder: React.FC<ProgramTrackControlProps> = (props) => {
  const openDialog = useOpenTrackDialog(props)
  const { currentTrack } = props.trackState
  return (
    <Placeholder>
      <span>
        <CurrentTrackLabel>Current track: </CurrentTrackLabel>
        <CurrentTrackTitle>
          {currentTrack?.title ?? "Not selected"}
        </CurrentTrackTitle>
      </span>
      <ChooseTrackButton type="button" onClick={openDialog}>
        {currentTrack ? "Change track" : "Choose track"}
      </ChooseTrackButton>
    </Placeholder>
  )
}

const ProgramChangeTrackLink: React.FC<ProgramTrackControlProps> = (props) => {
  const openDialog = useOpenTrackDialog(props)
  return (
    <ChangeTrackButton type="button" onClick={openDialog}>
      Change track
    </ChangeTrackButton>
  )
}

export { ProgramTrackPlaceholder, ProgramChangeTrackLink }
