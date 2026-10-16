import React from "react"
import {
  ChoiceBox,
  DialogActions,
  FormDialog,
  LoadingSpinner,
  Stack,
  Typography,
  styled,
} from "ol-components"
import { Alert, Button } from "@mitodl/smoot-design"
import NiceModal, { muiDialogV5 } from "@ebay/nice-modal-react"
import { useUpdateProgramEnrollmentTrack } from "api/mitxonline-hooks/enrollment"
import { SILENCE_ERROR_TOAST } from "api/mutation-meta"
import type { ProgramTrackOption } from "./model/dashboardViewModel"

const CurrentTrackChip = styled.span(({ theme }) => ({
  ...theme.typography.body4,
  display: "inline-block",
  marginLeft: "8px",
  padding: "2px 8px",
  borderRadius: "4px",
  backgroundColor: theme.custom.colors.lightGray2,
  color: theme.custom.colors.darkGray2,
}))

const TrackItems = styled.ul({
  display: "flex",
  flexWrap: "wrap",
  columnGap: "16px",
  margin: 0,
  padding: 0,
  listStyle: "none",
  "li::before": {
    content: '"• "',
  },
})

/**
 * Id of the track slot's heading on the program dashboard. Choosing a track
 * replaces the button that opened the dialog, so focus moves here instead.
 */
const PROGRAM_TRACK_HEADING_ID = "program-track-heading"

type ProgramTrackDialogProps = {
  programId: number
  tracks: ProgramTrackOption[]
  currentTrack: ProgramTrackOption | null
}

const ProgramTrackDialogInner: React.FC<ProgramTrackDialogProps> = ({
  programId,
  tracks,
  currentTrack,
}) => {
  const modal = NiceModal.useModal()
  const updateTrack = useUpdateProgramEnrollmentTrack({
    meta: SILENCE_ERROR_TOAST,
  })
  const [selectedId, setSelectedId] = React.useState<number | null>(
    currentTrack?.id ?? null,
  )
  const selected = tracks.find((track) => track.id === selectedId)
  const canSubmit = !!selected && selected.id !== currentTrack?.id

  const isChange = !!currentTrack
  let submitLabel = isChange ? "Switch track" : "Choose track"
  if (canSubmit) {
    submitLabel = isChange
      ? `Switch to ${selected.title}`
      : `Choose ${selected.title}`
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    updateTrack.mutate(
      {
        program_id: programId,
        PatchedV3ProgramEnrollmentTrackRequest: { track: selected.id },
      },
      {
        onSuccess: () =>
          modal
            .hide()
            .then(() =>
              document.getElementById(PROGRAM_TRACK_HEADING_ID)?.focus(),
            ),
      },
    )
  }

  return (
    <FormDialog
      title={isChange ? "Change track" : "Choose track"}
      fullWidth
      onSubmit={handleSubmit}
      {...muiDialogV5(modal)}
      actions={
        <DialogActions>
          <Button variant="secondary" onClick={() => modal.hide()}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={!canSubmit || updateTrack.isPending}
            endIcon={
              updateTrack.isPending ? (
                <LoadingSpinner color="inherit" loading={true} size={16} />
              ) : undefined
            }
          >
            {submitLabel}
          </Button>
        </DialogActions>
      }
    >
      <Typography variant="body1">
        {isChange
          ? "You can change tracks at any time. Switching tracks updates which courses are required, but any course progress you've made is saved. If you switch back, you'll pick up where you left off."
          : "Choose the track that best fits your goals. You can change tracks at any time without losing completed coursework or progress."}
      </Typography>
      <Stack role="radiogroup" aria-label="Tracks" gap="12px">
        {tracks.map((track) => {
          const checked = track.id === selectedId
          return (
            <ChoiceBox
              key={track.id}
              type="radio"
              name="program-track"
              value={String(track.id)}
              checked={checked}
              onChange={() => setSelectedId(track.id)}
              label={
                <>
                  {track.title}
                  {track.id === currentTrack?.id ? (
                    <CurrentTrackChip>Current track</CurrentTrackChip>
                  ) : null}
                </>
              }
              description={
                track.description || track.items.length > 0 ? (
                  <Stack gap="6px">
                    {track.description ? (
                      <span>{track.description}</span>
                    ) : null}
                    {track.items.length > 0 ? (
                      <TrackItems>
                        {track.items.map((item) => (
                          <li key={`${item.type}-${item.id}`}>{item.title}</li>
                        ))}
                      </TrackItems>
                    ) : null}
                  </Stack>
                ) : undefined
              }
            />
          )
        })}
      </Stack>
      {updateTrack.isError && (
        <Alert severity="error">
          There was a problem updating your track. Please try again later.
        </Alert>
      )}
    </FormDialog>
  )
}

const ProgramTrackDialog = NiceModal.create(ProgramTrackDialogInner)

export { ProgramTrackDialog, PROGRAM_TRACK_HEADING_ID }
