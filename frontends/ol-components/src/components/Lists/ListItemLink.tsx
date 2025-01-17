import React from "react"
import ListItemButton from "@mui/material/ListItemButton"
import type { ListItemButtonProps } from "@mui/material/ListItemButton"
import { styled } from "@mui/material-pigment-css"
import Link from "next/link"

type ListItemLinkProps = ListItemButtonProps<"a">

const ListItemButtonLink = ({ ...props }: ListItemLinkProps) => (
  <ListItemButton component={Link} {...props} />
)
/**
 * A ListItemButton that uses a Link component from react-router-dom.
 *
 * The purpose is to make the entire clickable area of a ListItem a link. Note
 * that `ListItem` should have `disablePadding` when it contains a `ListItemLink`
 * since the padding is applied to the link itself.
 */
const ListItemLink: React.FC<ListItemLinkProps> = styled(ListItemButtonLink)({
  ".MuiListItemText-root": {
    marginTop: 0,
    marginBottom: 0,
  },
})

export { ListItemLink }
export type { ListItemLinkProps }
