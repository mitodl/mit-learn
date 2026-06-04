"use client"

import React from "react"
import { Stack, Tooltip, Typography, styled } from "ol-components"
import { Button, Input } from "@mitodl/smoot-design"

const SectionCard = styled.div(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  padding: "24px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  [theme.breakpoints.down("md")]: {
    padding: "16px",
  },
}))

const SectionTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.h5,
  color: theme.custom.colors.black,
})) as typeof Typography

const MutedText = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.silverGrayDark,
})) as typeof Typography

const StyledInput = styled(Input)({
  flex: 1,
})

const ButtonWrapper = styled.span(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    "& > button": { width: "100%" },
  },
}))

const DisabledLink = styled.span(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.darkRed,
  textDecoration: "underline",
  cursor: "not-allowed",
  opacity: 0.5,
}))

/**
 * Assign Seats form section.
 *
 * Fully disabled pending backend write API availability.
 */
const AssignSeatsSection: React.FC = () => {
  return (
    <SectionCard>
      <div>
        <SectionTitle component="h2">Assign Seats</SectionTitle>
        <MutedText>
          Each learner will receive an email with a link to claim their seat and
          access the program.
        </MutedText>
      </div>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        gap="24px"
        alignItems="flex-start"
      >
        {/* Input instead of TextField: TextField's FormFieldWrapper always renders a label element in
            normal flow even when visually hidden, pushing the input ~4px below the button. Input is
            smoot-design's component for unlabelled fields; accessible name is supplied via aria-label. */}
        <Tooltip title="Coming soon">
          <StyledInput
            name="emails"
            inputProps={{ "aria-label": "Employee emails" }}
            multiline
            minRows={2}
            disabled
            placeholder="Enter employee emails (one per line or comma-separated)"
            fullWidth
          />
        </Tooltip>
        <Tooltip title="Coming soon">
          <ButtonWrapper>
            <Button variant="primary" disabled>
              Assign Seats
            </Button>
          </ButtonWrapper>
        </Tooltip>
      </Stack>
      <Stack direction="row" gap="4px" alignItems="center" flexWrap="wrap">
        <MutedText>Paste multiple emails or</MutedText>
        <Tooltip title="Coming soon">
          <DisabledLink role="button" aria-disabled="true" tabIndex={0}>
            import from CSV
          </DisabledLink>
        </Tooltip>
        <Tooltip title="Coming soon">
          <DisabledLink role="button" aria-disabled="true" tabIndex={0}>
            (download sample CSV)
          </DisabledLink>
        </Tooltip>
      </Stack>
    </SectionCard>
  )
}

export { AssignSeatsSection }
