import React, { MouseEvent } from "react"
import type { Meta, StoryObj } from "@storybook/nextjs"
import { NavData, NavDrawer } from "./NavDrawer"
import MuiButton from "@mui/material/Button"
import styled from "@emotion/styled"
import { RiPencilRulerLine } from "@remixicon/react"
import { useToggle } from "ol-utilities"

const StyledButton = styled(MuiButton)({
  position: "absolute",
  right: "20px",
})

const NavDrawerDemo = () => {
  const [open, setOpen] = useToggle(false)

  const handleClickOpen = (event: MouseEvent) => {
    setOpen(true)
    event.stopPropagation()
  }

  const navData: NavData = {
    sections: [
      {
        title: "Nav Drawer Title",
        items: [
          {
            title: "Link with description",
            description: "This link has a description",
            href: "https://mit.edu",
          },
          {
            title: "Link with no description",
            href: "https://ocw.mit.edu",
          },
          {
            title: "Link with icon",
            icon: <RiPencilRulerLine />,
            href: "https://mit.edu",
          },
          {
            title: "Link with icon and description",
            description: "This link has an icon and a description",
            icon: <RiPencilRulerLine />,
            href: "https://mit.edu",
          },
        ],
      },
    ],
  }

  return (
    <div>
      <StyledButton variant="outlined" onClick={handleClickOpen}>
        Toggle drawer
      </StyledButton>
      <NavDrawer navData={navData} open={open} onClose={setOpen.off} />
    </div>
  )
}

const meta: Meta<typeof NavDrawer> = {
  title: "smoot-design/NavDrawer",
  component: NavDrawerDemo,
  argTypes: {
    onReset: {
      action: "reset",
    },
    onClose: {
      action: "closed",
    },
  },
}

export default meta

type Story = StoryObj<typeof NavDrawer>

export const Simple: Story = {
  args: {
    title: "Simple",
  },
}
