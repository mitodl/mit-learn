"use client"

import React, { useState } from "react"
import {
  Dialog,
  Divider,
  FormDialog,
  Menu,
  MenuItem,
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
 * Pending rows: Change assigned email (reassign, confirmed), Resend claim
 * email (remind), Copy claim link, Release seat (revoke, confirmed).
 *
 * Redeemed rows: Uninvite (revoke, confirmed).
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
  const open = Boolean(anchorEl)

  const remind = useRemindCode()
  const revoke = useRevokeCode()
  const reassign = useReassignCode()

  const isRedeemed = code.redemption_status === "redeemed"

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
    try {
      await remind.mutateAsync({
        code: code.code,
        id: contractId,
        parent_lookup_organization: orgId,
      })
      onResult(
        `Claim email resent${code.assigned_to ? ` to ${code.assigned_to}` : ""}.`,
        "success",
      )
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
      onResult(isRedeemed ? "Learner uninvited." : "Seat released.", "success")
    } catch (err) {
      const status = (err as AxiosError)?.response?.status
      onResult(
        status === 409
          ? "This code has already been redeemed and cannot be revoked."
          : "Could not complete the action. Please try again.",
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

  const menuItems = isRedeemed ? (
    <DestructiveMenuItem onClick={openRevokeConfirm}>
      Uninvite
    </DestructiveMenuItem>
  ) : (
    [
      <ActionMenuItem key="change-email" onClick={openReassign}>
        Change assigned email
      </ActionMenuItem>,
      <ActionMenuItem key="resend-email" onClick={handleResend}>
        Resend claim email
      </ActionMenuItem>,
      copied ? (
        <CopiedMenuItem key="copy-link" disabled>
          Link copied to clipboard
        </CopiedMenuItem>
      ) : (
        <ActionMenuItem key="copy-link" onClick={handleCopyClaimLink}>
          Copy claim link
        </ActionMenuItem>
      ),
      <Divider component="li" role="separator" key="divider" />,
      <DestructiveMenuItem key="release-seat" onClick={openRevokeConfirm}>
        Release seat
      </DestructiveMenuItem>,
    ]
  )

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
        {menuItems}
      </Menu>
      <Dialog
        open={revokeConfirmOpen}
        onClose={() => setRevokeConfirmOpen(false)}
        onConfirm={handleRevokeConfirm}
        title={isRedeemed ? "Uninvite learner" : "Release seat"}
        confirmText={isRedeemed ? "Uninvite" : "Release seat"}
        maxWidth="sm"
      >
        {isRedeemed
          ? `This will remove ${assignedTo}'s access to the program. This cannot be undone.`
          : `This will revoke the invitation for ${assignedTo} and return the seat to the unassigned pool.`}
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
      >
        <Typography variant="body2">
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
