"use client"

import React, { useId, useState } from "react"
import { Dialog, Stack, Typography, styled } from "ol-components"
import { VisuallyHidden } from "@mitodl/smoot-design"
import { pluralize } from "ol-utilities"

const SHOW_MORE_THRESHOLD = 10

const SectionLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.custom.colors.darkGray2,
})) as typeof Typography

const EmailList = styled.ul(({ theme }) => ({
  margin: "4px 0 0",
  paddingLeft: "20px",
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
}))

const ShowMoreButton = styled.button(({ theme }) => ({
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  ...theme.typography.body2,
  color: theme.custom.colors.darkRed,
  textDecoration: "underline",
  "&:hover": { opacity: 0.8 },
}))

const DuplicateNotice = styled(Typography)(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.darkGray2,
})) as typeof Typography

type InvalidEmailListProps = {
  emails: string[]
}

const InvalidEmailList: React.FC<InvalidEmailListProps> = ({ emails }) => {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? emails : emails.slice(0, SHOW_MORE_THRESHOLD)
  const hidden = emails.length - SHOW_MORE_THRESHOLD

  return (
    <div>
      <EmailList>
        {visible.map((email) => (
          <li key={email}>{email}</li>
        ))}
      </EmailList>
      {!expanded && hidden > 0 && (
        <ShowMoreButton onClick={() => setExpanded(true)}>
          +{hidden} more
        </ShowMoreButton>
      )}
    </div>
  )
}

type AssignSeatsConfirmModalProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  validCount: number
  invalidEmails: string[]
  duplicateCount: number
}

const AssignSeatsConfirmModal: React.FC<AssignSeatsConfirmModalProps> = ({
  open,
  onClose,
  onConfirm,
  validCount,
  invalidEmails,
  duplicateCount,
}) => {
  const descriptionId = useId()
  const hasIssues = invalidEmails.length > 0 || duplicateCount > 0
  const confirmText = `Send ${validCount} ${pluralize("email", validCount)}`
  const descriptionText = hasIssues
    ? `${validCount} ${pluralize("email", validCount)} imported and ready to assign.${duplicateCount > 0 ? ` ${duplicateCount} ${pluralize("duplicate", duplicateCount)} removed — only 1 instance kept per address.` : ""}`
    : `Are you sure you want to send invitations to ${validCount} ${pluralize("recipient", validCount)}?`

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`${validCount} ${pluralize("email", validCount)} ready to assign`}
      confirmText={confirmText}
      cancelText="Cancel"
      fullWidth
      maxWidth="sm"
      aria-describedby={descriptionId}
    >
      <VisuallyHidden id={descriptionId}>{descriptionText}</VisuallyHidden>
      <Stack gap="16px">
        <Typography variant="body1">
          {hasIssues
            ? `${validCount} ${pluralize("email", validCount)} imported and ready to assign.`
            : `Are you sure you want to send invitations to ${validCount} ${pluralize("recipient", validCount)}?`}
        </Typography>
        {duplicateCount > 0 && (
          <DuplicateNotice>
            {duplicateCount} {pluralize("duplicate", duplicateCount)} removed —
            only 1 instance kept per address.
          </DuplicateNotice>
        )}
        {invalidEmails.length > 0 && (
          <Stack gap="4px">
            <SectionLabel component="p">
              These addresses were not valid and were not added:
            </SectionLabel>
            <InvalidEmailList emails={invalidEmails} />
          </Stack>
        )}
      </Stack>
    </Dialog>
  )
}

export { AssignSeatsConfirmModal }
export type { AssignSeatsConfirmModalProps }
