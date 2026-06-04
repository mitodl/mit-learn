"use client"

import React, { useState } from "react"
import { Divider, Menu, MenuItem, Tooltip, styled } from "ol-components"
import { RiMoreLine } from "@remixicon/react"
import { ActionButton, VisuallyHidden } from "@mitodl/smoot-design"
import { b2bAttachView } from "@/common/urls"
import type { ContractCode } from "api/mitxonline-hooks/organizations"

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

type RowActionMenuProps = {
  code: ContractCode
}

const COMING_SOON = "Coming soon"

/**
 * Three-dot row action menu for the contract admin codes table.
 *
 * Pending rows: Change assigned email (disabled), Resend claim email
 * (disabled), Copy claim link (functional), Release seat (disabled).
 *
 * Redeemed rows: Uninvite (disabled).
 *
 * NOTE: All actions except "Copy claim link" are disabled pending backend
 * write API availability.
 */
const RowActionMenu: React.FC<RowActionMenuProps> = ({ code }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const [copied, setCopied] = useState(false)
  const open = Boolean(anchorEl)

  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(e.currentTarget)
    setCopied(false)
  }

  const handleClose = () => {
    setAnchorEl(null)
    setCopied(false)
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

  const assignedTo = code.redeemed_by ?? "unassigned seat"

  const menuItems = code.is_redeemed ? (
    <Tooltip title={COMING_SOON} placement="right">
      <DestructiveMenuItem disabled>Uninvite</DestructiveMenuItem>
    </Tooltip>
  ) : (
    [
      <Tooltip key="change-email" title={COMING_SOON} placement="right">
        <ActionMenuItem disabled>Change assigned email</ActionMenuItem>
      </Tooltip>,
      <Tooltip key="resend-email" title={COMING_SOON} placement="right">
        <ActionMenuItem disabled>Resend claim email</ActionMenuItem>
      </Tooltip>,
      copied ? (
        <CopiedMenuItem key="copy-link" disabled>
          Link copied to clipboard
        </CopiedMenuItem>
      ) : (
        <ActionMenuItem key="copy-link" onClick={handleCopyClaimLink}>
          Copy claim link
        </ActionMenuItem>
      ),
      <Divider key="divider" />,
      <Tooltip key="release-seat" title={COMING_SOON} placement="right">
        <DestructiveMenuItem disabled>Release seat</DestructiveMenuItem>
      </Tooltip>,
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
    </>
  )
}

export { RowActionMenu }
