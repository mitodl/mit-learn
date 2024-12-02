import React, { useCallback, useEffect, useMemo } from "react"
import Drawer from "@mui/material/Drawer"
import styled from "@emotion/styled"
import type { DrawerProps } from "@mui/material/Drawer"
import { ActionButton } from "../Button/Button"
import { RiCloseLargeLine } from "@remixicon/react"
import {
  useSearchParams,
  useRouter,
  ReadonlyURLSearchParams,
  useParams,
  usePathname,
} from "next/navigation"
import { useToggle } from "ol-utilities"

const CloseButton = styled(ActionButton)({
  position: "absolute",
  top: "16px",
  right: "22px",
})

type ChildParams<K extends string, R extends K> = Record<K, string | null> &
  Record<R, string>

type RoutedDrawerProps<K extends string = string, R extends K = K> = {
  params?: readonly K[]
  requiredParams: readonly R[]
  onView?: () => void
  hideCloseButton?: boolean
  children: React.ReactNode
  anchor: string
} & Omit<DrawerProps, "open" | "onClose" | "children">

const RoutedDrawer = <K extends string, R extends K = K>(
  props: RoutedDrawerProps<K, R>,
) => {
  const { requiredParams, children, onView, hideCloseButton, ...others } = props
  const params = useParams<{ resourceId: string }>()

  const [open, setOpen] = useToggle(!!params.resourceId)
  const pathname = usePathname()

  useEffect(() => {
    if (!open) {
      setOpen(!!pathname.match(/resource\/\d+$/))
    }
  }, [pathname, setOpen])

  const removeUrlParams = () => {
    window.history.pushState(null, "", pathname.replace(/resource\/\d+$/, ""))
  }

  const onDrawerClose = () => {
    setOpen(false)
  }

  return (
    <Drawer
      open={open}
      onTransitionExited={removeUrlParams}
      onClose={onDrawerClose}
      {...others}
    >
      {
        <>
          {open && children}
          {!hideCloseButton && (
            <CloseButton
              variant="text"
              size="medium"
              onClick={onDrawerClose}
              aria-label="Close"
            >
              <RiCloseLargeLine />
            </CloseButton>
          )}
        </>
      }
    </Drawer>
  )
}

export { RoutedDrawer }
export type { RoutedDrawerProps }
