import React, { useCallback, useMemo, useState } from "react"
import Menu, { MenuProps } from "@mui/material/Menu"
import { MenuItem } from "../MenuItem/MenuItem"
import ListItemIcon from "@mui/material/ListItemIcon"
import { default as RouterLink } from "next/link"

interface SimpleMenuItemBase {
  key: string
  label: React.ReactNode
  icon?: React.ReactNode
  className?: string
  LinkComponent?: React.ElementType
}

type SimpleMenuItemOnClick = SimpleMenuItemBase & {
  onClick: () => void
  href?: string
}

type SimpleMenuItemHref = SimpleMenuItemBase & {
  onClick?: () => void
  href: string
}

type MenuOverrideProps = Omit<MenuProps, "open" | "anchorEl" | "close">
type SimpleMenuItem = SimpleMenuItemOnClick | SimpleMenuItemHref

type TriggerElement = React.ReactElement<{
  onClick?: (e: React.MouseEvent) => void
  ref?: React.Ref<HTMLElement>
}>

type SimpleMenuProps = {
  items: SimpleMenuItem[]
  menuOverrideProps?: MenuOverrideProps
  trigger: TriggerElement
  onVisibilityChange?: (visible: boolean) => void
}

/**
 * A wrapper around MUI's Menu that handles visibility, icons, placement
 * relative to trigger, and links as children.
 *
 * By default <SimpleMenu /> will render links using React Router's <Link />
 * component for SPA routing. For external links or links where a full reload
 * is desirable, an anchor tag is more appropriate. Use `LinkComponent: "a"`
 * in such cases.
 */
const SimpleMenu: React.FC<SimpleMenuProps> = ({
  items,
  menuOverrideProps,
  trigger: _trigger,
  onVisibilityChange,
}) => {
  const [open, _setOpen] = useState(false)
  const setOpen = useCallback(
    (newValue: boolean) => {
      _setOpen(newValue)
      if (newValue !== open) {
        onVisibilityChange?.(newValue)
      }
    },
    [open, onVisibilityChange],
  )

  const [el, setEl] = useState<HTMLElement | null>(null)

  const trigger = useMemo(() => {
    return React.cloneElement(_trigger, {
      onClick: (e: React.MouseEvent) => {
        setOpen(!open)
        _trigger.props.onClick?.(e)
      },
      ref: setEl,
    })
  }, [_trigger, setOpen, open])

  return (
    <>
      {trigger}
      <Menu
        open={open}
        anchorEl={el}
        onClose={() => setOpen(false)}
        {...menuOverrideProps}
      >
        {items.map((item) => {
          const linkProps = item.href
            ? {
                /**
                 * Used to render the MenuItem as a react router link (or
                 * specified link component) instead of a <li>.
                 *
                 * This is technically invalid HTML: The child of a <ul> should
                 * be a <li>. However, this seems to be the most accessible way
                 * to render a link inside MUI's <Menu /> components.
                 *
                 * See:
                 *  - https://github.com/mui/material-ui/issues/33268
                 *  - https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/examples/menu-button-links/
                 *    shows a more correct implementation.
                 */
                component: item.LinkComponent ?? RouterLink,
                href: item.href,
              }
            : {}
          const onClick = () => {
            item.onClick?.()
            setOpen(false)
          }
          return (
            <MenuItem
              {...linkProps}
              className={item.className}
              key={item.key}
              onClick={onClick}
            >
              {item.icon ? <ListItemIcon>{item.icon}</ListItemIcon> : null}
              {item.label}
            </MenuItem>
          )
        })}
      </Menu>
    </>
  )
}

export { SimpleMenu }
export type { SimpleMenuProps, MenuOverrideProps, SimpleMenuItem }
