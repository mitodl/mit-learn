"use client"

import { styled } from "ol-components"
import { RiMenuLine } from "@remixicon/react"
import React from "react"

const MenuIcon = styled(RiMenuLine)({})

const MenuButtonText = styled.div(({ theme }) => ({
  alignSelf: "center",
  paddingLeft: "16px",
  textTransform: "none",
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
  ...theme.typography.subtitle2,
}))

const MenuButtonInner = styled.div({
  display: "flex",
  alignItems: "flex-start",
})

const StyledMenuButton = styled.button<{ active?: boolean }>(
  ({ theme, active }) => ({
    padding: "8px 16px",
    background: "transparent",
    "&:hover:not(:disabled)": {
      background: "transparent",
    },
    touchAction: "none",
    textAlign: "center",
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    color: active
      ? theme.custom.colors.white
      : theme.custom.colors.silverGrayLight,
    transition: `color ${theme.transitions.duration.short}ms`,
    cursor: "pointer",
    borderStyle: "none",
    svg: {
      color: active
        ? theme.custom.colors.white
        : theme.custom.colors.silverGray,
      transition: `color ${theme.transitions.duration.short}ms`,
    },
    "&:hover": {
      color: theme.custom.colors.white,
      svg: { color: theme.custom.colors.white },
    },
    [theme.breakpoints.down("md")]: {
      padding: "4px 0",
    },
  }),
)

interface MenuButtonProps {
  text?: string
  onClick: React.MouseEventHandler<HTMLButtonElement> | undefined
  active?: boolean
}

const MenuButton = React.forwardRef<HTMLButtonElement, MenuButtonProps>(
  ({ onClick, text, active }, ref) => (
    <StyledMenuButton ref={ref} onClick={onClick} active={active}>
      <MenuButtonInner>
        <MenuIcon />
        {text ? <MenuButtonText>{text}</MenuButtonText> : ""}
      </MenuButtonInner>
    </StyledMenuButton>
  ),
)

export { MenuButton }
