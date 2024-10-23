import Drawer, { DrawerProps } from "@mui/material/Drawer"
import ClickAwayListener from "@mui/material/ClickAwayListener"
import { FocusTrap } from "@mui/base/FocusTrap"
import styled from "@emotion/styled"
import React, { ReactElement } from "react"
import { RiCloseLargeLine } from "@remixicon/react"
import { ActionButton } from "../Button/Button"

const DrawerContent = styled.div(({ theme }) => ({
  paddingTop: theme.custom.dimensions.headerHeight,
  width: "366px",
  height: "100%",
  background: theme.custom.colors.white,
  borderRight: `1px solid ${theme.custom.colors.lightGray2}`,
  [theme.breakpoints.down("sm")]: {
    paddingTop: theme.custom.dimensions.headerHeightSm,
  },
}))

const NavSection = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  alignSelf: "stretch",
  padding: "24px 32px 8px 32px",
  gap: "12px",
})

const NavSectionHeader = styled.div<{ hasButton: boolean }>(
  ({ theme, hasButton }) => [
    {
      display: "flex",
      alignItems: "center",
      alignSelf: "stretch",
      color: theme.custom.colors.darkGray1,
      ...theme.typography.subtitle3,
    },
    hasButton && {
      justifyContent: "space-between",
      height: "16px",
    },
  ],
)

const NavItemsContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  alignSelf: "stretch",
  gap: "12px",
  color: theme.custom.colors.silverGrayDark,
}))

const NavItemLink = styled.a({
  display: "flex",
  alignItems: "flex-start",
  alignSelf: "stretch",
  textDecoration: "none !important",
})

const NavItemContainer = styled.div(({ theme }) => ({
  display: "flex",
  padding: "4px 0",
  alignItems: "flex-start",
  alignSelf: "stretch",
  gap: "16px",
  "&:hover": {
    color: theme.custom.colors.darkGray2,
    ".nav-link-icon": {
      opacity: "1",
    },
    ".nav-link-text": {
      color: theme.custom.colors.red,
      textDecorationLine: "underline",
      textDecorationColor: theme.custom.colors.red,
    },
  },
}))

const NavIconContainer = styled.div({
  display: "flex",
  alignItems: "flex-start",
})

const NavIcon = styled.img({
  width: "22px",
  height: "22px",
  opacity: ".7",
})

const NavTextContainer = styled.div({
  display: "flex",
  flex: "1 0 0",
  flexDirection: "column",
  alignItems: "flex-start",
  alignSelf: "center",
  gap: "4px",
})

const CloseButton = styled(ActionButton)(({ theme }) => ({
  svg: { fontSize: "18px" },
  color: theme.custom.colors.darkGray1,
  transform: "translateX(12px)",
}))

const NavLinkText = styled.div(({ theme }) => ({
  color: theme.custom.colors.darkGray2,
  ...theme.typography.subtitle3,
}))

const NavLinkDescription = styled.div(({ theme }) => ({
  alignSelf: "stretch",
  ...theme.typography.body3,
}))

export interface NavData {
  sections: NavSection[]
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export interface NavItem {
  title: string
  icon?: string | ReactElement
  description?: string
  href: string
}

const NavItem: React.FC<NavItem> = (props) => {
  const { title, icon, description, href } = props
  const navItem = (
    <NavItemContainer>
      <NavIconContainer style={{ paddingTop: description ? "4px" : "" }}>
        {typeof icon === "string" ? (
          <NavIcon
            src={icon}
            className="nav-link-icon"
            data-testid="nav-link-icon"
          />
        ) : null}
        {typeof icon !== "string" ? icon : null}
      </NavIconContainer>
      <NavTextContainer>
        <NavLinkText className="nav-link-text" data-testid="nav-link-text">
          {title}
        </NavLinkText>
        {description ? (
          <NavLinkDescription data-testid="nav-link-description">
            {description}
          </NavLinkDescription>
        ) : null}
      </NavTextContainer>
    </NavItemContainer>
  )
  return (
    <NavItemLink href={href} data-testid="nav-link">
      {navItem}
    </NavItemLink>
  )
}

type NavDrawerProps = {
  navdata: NavData
  onClose: () => void
  /**
   * Returns a list of HTMLElements that should not trigger the drawer to close
   * on click-away
   */
  getClickAwayExcluded?: () => (Element | null)[]
} & DrawerProps

const NavDrawer = ({
  navdata,
  onClose,
  getClickAwayExcluded = () => [],
  ...others
}: NavDrawerProps) => {
  const navSections = navdata.sections.map((section, i) => {
    const navItemElements = section.items.map((item) => (
      <NavItem
        key={item.title}
        title={item.title}
        icon={item.icon}
        description={item.description}
        href={item.href}
      />
    ))
    return (
      <NavSection key={section.title}>
        <NavSectionHeader hasButton={i === 0}>
          {section.title}
          {i === 0 && (
            <CloseButton
              aria-label="Close Navigation"
              onClick={onClose}
              variant="text"
              size="small"
            >
              <RiCloseLargeLine aria-hidden />
            </CloseButton>
          )}
        </NavSectionHeader>
        <NavItemsContainer>{navItemElements}</NavItemsContainer>
      </NavSection>
    )
  })

  return (
    /**
     * ClickAwayListner + FocusTrap ensure the drawer behaves like a modal:
     *  - clicking outside the drawer closes it
     *  - the drawer traps focus
     *
     * But the drawer is persistent in that:
     *  - Events (clicks, scrolls) outside the drawer fire on the underlying
     *    content, not on an overlay element.
     */
    <ClickAwayListener
      onClickAway={(e) => {
        if (!others.open) return
        const excluded = getClickAwayExcluded()
        const target = e.target
        if (
          target instanceof Element &&
          excluded?.some((el) => el?.contains(target))
        ) {
          return
        }
        onClose()
      }}
    >
      <div role="presentation">
        <Drawer
          anchor="left"
          variant="persistent"
          elevation={0}
          hideBackdrop={true}
          PaperProps={{
            sx: {
              borderRight: "none",
              boxShadow: "0px 6px 24px 0px rgba(37, 38, 43, 0.10)",
              zIndex: (theme) => theme.zIndex.appBar - 1,
              overscrollBehavior: "contain",
            },
          }}
          {...others}
        >
          <FocusTrap open={!!others.open}>
            <DrawerContent
              onKeyUp={(e) => {
                if (e.key === "Escape") {
                  onClose()
                }
              }}
              tabIndex={-1}
            >
              {navSections}
            </DrawerContent>
          </FocusTrap>
        </Drawer>
      </div>
    </ClickAwayListener>
  )
}

export { NavDrawer }
export type { NavDrawerProps }
