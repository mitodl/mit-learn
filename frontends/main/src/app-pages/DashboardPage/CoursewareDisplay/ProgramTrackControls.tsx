import React from "react"
import NiceModal from "@ebay/nice-modal-react"
import { linkStyles, styled } from "ol-components"
import { ProgramTrackDialog } from "./ProgramTrackDialog"
import type { ProgramTrackState } from "./model/dashboardViewModel"

const buttonReset = {
  padding: 0,
  border: "none",
  background: "none",
  cursor: "pointer",
}

const ChangeTrackButton = styled.button(
  buttonReset,
  linkStyles({ color: "red" }),
  { textDecoration: "underline", whiteSpace: "nowrap" },
)

const ChooseTrackButton = styled.button(
  buttonReset,
  linkStyles({ color: "red" }),
  ({ theme }) => ({
    ...theme.typography.subtitle1,
    fontWeight: theme.typography.fontWeightBold,
  }),
)

const Placeholder = styled.div(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  alignItems: "center",
  gap: "16px",
  padding: "32px",
  border: `1px dashed ${theme.custom.colors.silverGrayLight}`,
  borderRadius: "8px",
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

const openTrackDialog = ({
  programId,
  trackState: { tracks, currentTrack },
}: ProgramTrackControlProps) =>
  NiceModal.show(ProgramTrackDialog, { programId, tracks, currentTrack })

/**
 * Stands in for the track's sections until the learner's chosen track has
 * courses to show.
 */
const ProgramTrackPlaceholder: React.FC<ProgramTrackControlProps> = (props) => {
  const { currentTrack } = props.trackState
  return (
    <Placeholder>
      <span>
        <CurrentTrackLabel>Current track: </CurrentTrackLabel>
        <CurrentTrackTitle>
          {currentTrack?.title ?? "Not selected"}
        </CurrentTrackTitle>
      </span>
      <ChooseTrackButton type="button" onClick={() => openTrackDialog(props)}>
        {currentTrack ? "Change track" : "Choose track"}
      </ChooseTrackButton>
    </Placeholder>
  )
}

const ProgramChangeTrackLink: React.FC<ProgramTrackControlProps> = (props) => {
  return (
    <ChangeTrackButton type="button" onClick={() => openTrackDialog(props)}>
      Change track
    </ChangeTrackButton>
  )
}

export { ProgramTrackPlaceholder, ProgramChangeTrackLink }
