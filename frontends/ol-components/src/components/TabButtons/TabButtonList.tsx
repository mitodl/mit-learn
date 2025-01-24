import React from "react"
import { styled } from "@pigment-css/react"
import MuiTab from "@mui/material/Tab"
import type { TabProps } from "@mui/material/Tab"
import MuiTabList from "@mui/lab/TabList"
import type { TabListProps } from "@mui/lab/TabList"
import { Button, ButtonLink } from "../Button/Button"
import type { ButtonLinkProps, ButtonProps } from "../Button/Button"

const defaultTabListProps = {
  variant: "scrollable",
  allowScrollButtonsMobile: true,
  scrollButtons: "auto",
} as const

const StyledMuiTabList = styled(MuiTabList)({
  minHeight: "unset",
  ".MuiTabs-indicator": {
    display: "none",
  },
  ".MuiTabs-flexContainer": {
    gap: "8px",
    alignItems: "center",
  },
  ".MuiTabs-scroller": {
    display: "flex",
  },
})

const TabButtonList: React.FC<TabListProps> = (props: TabListProps) => (
  <StyledMuiTabList {...defaultTabListProps} {...props} />
)

const TabButtonStyled = styled(Button)(({ theme }) => ({
  minWidth: "auto",
  ":focus-visible": {
    outlineOffset: "-1px",
  },
  '&[aria-selected="true"]': {
    backgroundColor: theme.custom.colors.white,
    borderColor: theme.custom.colors.darkGray2,
  },
}))

const TabLinkStyled = styled(ButtonLink)(({ theme }) => ({
  minWidth: "auto",
  ":focus-visible": {
    outlineOffset: "-1px",
  },
  '&[aria-selected="true"]': {
    backgroundColor: theme.custom.colors.white,
    borderColor: theme.custom.colors.darkGray2,
  },
}))

const tabButtonProps = {
  variant: "tertiary",
  size: "small",
} as const
const TabButtonInner = React.forwardRef<HTMLButtonElement, ButtonProps>(
  // Omits the `className` prop from the underlying Button so that MUI does not
  // style it. We style it ourselves.
  (props, ref) => {
    const { className, ...others } = props
    return <TabButtonStyled {...tabButtonProps} {...others} ref={ref} />
  },
)

const TabLinkInner = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  (props, ref) => {
    const { className, ...others } = props
    return <TabLinkStyled {...tabButtonProps} {...others} ref={ref} />
  },
)

type TabButtonProps = Omit<TabProps<"button">, "color">
const TabButton = (props: TabButtonProps) => (
  <MuiTab {...props} component={TabButtonInner} />
)

const TabButtonLink = ({ ...props }: TabProps<typeof TabLinkInner>) => (
  <MuiTab {...props} component={TabLinkInner} />
)

export { TabButtonList, TabButton, TabButtonLink }
