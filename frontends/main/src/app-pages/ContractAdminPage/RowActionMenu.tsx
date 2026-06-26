"use client"

import React, { useId, useState } from "react"
import {
  Dialog,
  Divider,
  FormDialog,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
  styled,
} from "ol-components"
import { RiMoreLine } from "@remixicon/react"
import { ActionButton, TextField, VisuallyHidden } from "@mitodl/smoot-design"
import { isValidEmail } from "ol-utilities"
import { b2bAttachView } from "@/common/urls"
import {
  useReassignCode,
  useRemindCode,
  useRevokeCode,
} from "api/mitxonline-hooks/organizations"
import type { ContractCode } from "api/mitxonline-hooks/organizations"
import type { AxiosError } from "axios"

const ActionMenuItem = styled(MenuItem)(({ theme }) => ({
  ...theme.typography.body3,
  padding: "8px 12px",
  color: theme.custom.colors.darkGray2,
  backgroundColor: theme.custom.colors.white,
  minWidth: "160px",
  "&:hover": {
    backgroundColor: theme.custom.colors.lightGray1,
  },
  "&.Mui-disabled": {
    opacity: 1,
    color: theme.custom.colors.silverGrayDark,
    // Restore pointer events so Tooltip can detect hover on disabled items
    pointerEvents: "auto",
    cursor: "default",
  },
}))

const DestructiveMenuItem = styled(ActionMenuItem)(({ theme }) => ({
  color: theme.custom.colors.red,
  "&.Mui-disabled": {
    color: theme.custom.colors.red,
    opacity: 0.5,
    pointerEvents: "auto",
    cursor: "default",
  },
}))

const CopiedMenuItem = styled(ActionMenuItem)(({ theme }) => ({
  color: theme.custom.colors.green,
  "&.Mui-disabled": {
    color: theme.custom.colors.green,
  },
  "&:hover": {
    backgroundColor: theme.custom.colors.white,
    cursor: "default",
  },
}))

type ActionSeverity = "success" | "error"

type RowActionMenuProps = {
  code: ContractCode
  orgId: number
  contractId: number
  /** Surfaces action outcomes in the page-level result Alert. */
  onResult: (message: string, severity: ActionSeverity) => void
}

/**
 * Three-dot row action menu for the contract admin codes table.
 *
 * Pending (assigned) rows: Change assigned email, Resend claim email, Copy
 * claim link, Release seat.
 *
 * Redeemed rows: button is disabled — no actions available.
 */
const RowActionMenu: React.FC<RowActionMenuProps> = ({
  code,
  orgId,
  contractId,
  onResult,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const [copied, setCopied] = useState(false)
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [reassignEmail, setReassignEmail] = useState("")
  const [reassignTouched, setReassignTouched] = useState(false)
  const revokeDescId = useId()
  const reassignDescId = useId()
  const open = Boolean(anchorEl)

  const remind = useRemindCode()
  const revoke = useRevokeCode()
  const reassign = useReassignCode()

  const isRedeemed = code.redemption_status === "redeemed"
  const hasAssignedEmail = Boolean(code.assigned_to?.trim())

  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(e.currentTarget)
    setCopied(false)
  }

  const handleClose = () => {
    setAnchorEl(null)
    setCopied(false)
  }

  const handleResend = async () => {
    handleClose()
    // No recipient to remind — the menu item is disabled in this state, so this
    // is a defensive guard against an already-redeemed or unassigned code.
    if (isRedeemed || !hasAssignedEmail) return
    try {
      await remind.mutateAsync({
        code: code.code,
        id: contractId,
        parent_lookup_organization: orgId,
      })
      onResult(`Claim email resent to ${code.assigned_to}.`, "success")
    } catch {
      onResult("Could not resend the claim email. Please try again.", "error")
    }
  }

  const handleRevokeConfirm = async () => {
    try {
      await revoke.mutateAsync({
        code: code.code,
        id: contractId,
        parent_lookup_organization: orgId,
      })
      onResult("Seat released.", "success")
    } catch (err) {
      const status = (err as AxiosError)?.response?.status
      onResult(
        status === 409
          ? "This seat has already been redeemed and cannot be released."
          : "Could not release the seat. Please try again.",
        "error",
      )
    }
    // Dialog closes itself once this resolves.
  }

  const handleCopyClaimLink = async () => {
    const url = `${window.location.origin}${b2bAttachView(code.code)}`
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
      } else {
        // execCommand fallback for non-secure contexts (HTTP dev environments).
        // Sets clipboard data via the copy event directly, bypassing focus trap
        // issues caused by MUI Menu.
        await new Promise<void>((resolve, reject) => {
          const handler = (e: ClipboardEvent) => {
            e.clipboardData?.setData("text/plain", url)
            e.preventDefault()
            resolve()
          }
          document.addEventListener("copy", handler, { once: true })
          const success = document.execCommand("copy")
          if (!success) {
            document.removeEventListener("copy", handler)
            reject(new Error("execCommand copy failed"))
          }
        })
      }
      setCopied(true)
    } catch {
      // clipboard write failed — leave copied=false
    }
  }

  const assignedTo = code.assigned_to ?? "unassigned seat"

  const openRevokeConfirm = () => {
    handleClose()
    setRevokeConfirmOpen(true)
  }

  const openReassign = () => {
    handleClose()
    setReassignEmail(code.assigned_to ?? "")
    setReassignTouched(false)
    setReassignOpen(true)
  }

  const emailValid = isValidEmail(reassignEmail.trim())

  const handleReassignSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const email = reassignEmail.trim()
    if (!emailValid) {
      setReassignTouched(true)
      return
    }
    try {
      await reassign.mutateAsync({
        code: code.code,
        id: contractId,
        parent_lookup_organization: orgId,
        AssignRevokeCodeRequestRequest: { email },
      })
      onResult(`Invitation reassigned to ${email}.`, "success")
      setReassignOpen(false)
    } catch (err) {
      const status = (err as AxiosError)?.response?.status
      onResult(
        status === 409
          ? "This code has already been redeemed and cannot be reassigned."
          : "Could not change the assigned email. Please try again.",
        "error",
      )
      setReassignOpen(false)
    }
  }

  // Redeemed rows have no available actions — render a disabled button only.
  if (isRedeemed) {
    return (
      <ActionButton
        aria-label={`No actions available for ${assignedTo}`}
        variant="text"
        size="small"
        disabled
      >
        <RiMoreLine size={16} />
      </ActionButton>
    )
  }

  return (
    <>
      <VisuallyHidden aria-live="polite">
        {copied ? "Link copied to clipboard" : ""}
      </VisuallyHidden>
      <ActionButton
        id={`row-action-trigger-${code.id}`}
        onClick={handleOpen}
        aria-label={`More actions for ${assignedTo}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `row-action-menu-${code.id}` : undefined}
        variant="text"
        size="small"
      >
        <RiMoreLine size={16} />
      </ActionButton>
      <Menu
        id={`row-action-menu-${code.id}`}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        MenuListProps={{ "aria-labelledby": `row-action-trigger-${code.id}` }}
      >
        <ActionMenuItem onClick={openReassign}>
          Change assigned email
        </ActionMenuItem>
        {hasAssignedEmail ? (
          <ActionMenuItem onClick={handleResend}>
            Resend claim email
          </ActionMenuItem>
        ) : (
          <Tooltip title="No email is assigned to this seat yet." describeChild>
            <ActionMenuItem disabled aria-label="Resend claim email">
              Resend claim email
            </ActionMenuItem>
          </Tooltip>
        )}
        {copied ? (
          <CopiedMenuItem disabled>Link copied to clipboard</CopiedMenuItem>
        ) : (
          <ActionMenuItem onClick={handleCopyClaimLink}>
            Copy claim link
          </ActionMenuItem>
        )}
        <Divider component="li" role="separator" />
        <DestructiveMenuItem onClick={openRevokeConfirm}>
          Release seat
        </DestructiveMenuItem>
      </Menu>
      <Dialog
        open={revokeConfirmOpen}
        onClose={() => setRevokeConfirmOpen(false)}
        onConfirm={handleRevokeConfirm}
        title="Release seat"
        confirmText="Release seat"
        maxWidth="sm"
        aria-describedby={revokeDescId}
      >
        <p id={revokeDescId} style={{ margin: 0 }}>
          {`This will revoke the invitation for ${assignedTo} and return the seat to the unassigned pool.`}
        </p>
      </Dialog>
      <FormDialog
        open={reassignOpen}
        title="Change assigned email"
        confirmText="Reassign seat"
        onClose={() => setReassignOpen(false)}
        onSubmit={handleReassignSubmit}
        disabled={!emailValid}
        maxWidth="sm"
        noValidate
        aria-describedby={reassignDescId}
      >
        <Typography variant="body2" id={reassignDescId}>
          The invitation for {assignedTo} will be reassigned to the new address
          and a claim email sent there.
        </Typography>
        <TextField
          name="email"
          label="New email address"
          type="email"
          value={reassignEmail}
          onChange={(e) => {
            setReassignEmail(e.target.value)
            setReassignTouched(true)
          }}
          error={reassignTouched && !emailValid}
          errorText={
            reassignTouched && !emailValid
              ? "Enter a valid email address."
              : undefined
          }
          required
          fullWidth
        />
      </FormDialog>
    </>
  )
}

export { RowActionMenu }
