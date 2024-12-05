import React, { useCallback, useEffect, useMemo } from "react"
import Drawer from "@mui/material/Drawer"
import styled from "@emotion/styled"
import type { DrawerProps } from "@mui/material/Drawer"
import { ActionButton } from "../Button/Button"
import { RiCloseLargeLine } from "@remixicon/react"
import { useSearchParams, ReadonlyURLSearchParams } from "next/navigation"
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
  children: (childProps: {
    params: ChildParams<K, R>
    closeDrawer: () => void
  }) => React.ReactNode
} & Omit<DrawerProps, "open" | "onClose" | "children">

const RoutedDrawer = <K extends string, R extends K = K>(
  props: RoutedDrawerProps<K, R>,
) => {
  const { requiredParams, children, onView, hideCloseButton, ...others } = props
  const { params = requiredParams } = props

  const [open, setOpen] = useToggle(false)
  const searchParams = useSearchParams()

  const childParams = useMemo(() => {
    return Object.fromEntries(
      params.map((name) => [name, searchParams.get(name)] as const),
    ) as Record<K, string | null>
  }, [searchParams, params])

  /**
   * `requiredArePresent` and `open` are usually the same, except when the
   * drawer is in the process of closing.
   *  - `open` changes to false when the drawer begins closing
   *  - URL Params are updated when the drawer finishes closing, changing the
   *   value of `requiredArePresent`
   *
   * This means that if content within the drawer depends on the search params,
   * then the content will remain visible during the closing animation.
   */
  const requiredArePresent = requiredParams.every(
    (name) => childParams[name] !== null,
  )

  useEffect(() => {
    if (requiredArePresent) {
      setOpen(true)
    } else {
      setOpen(false)
    }
  }, [requiredArePresent, setOpen, requiredParams])

  const removeUrlParams = useCallback(() => {
    const getNewParams = (current: ReadonlyURLSearchParams) => {
      const newSearchParams = new URLSearchParams(current)
      params.forEach((param) => {
        newSearchParams.delete(param)
      })

      return newSearchParams
    }
    const newParams = getNewParams(searchParams)

    const hash = window?.location.hash

    window.history.pushState({}, "", `?${newParams}${hash || ""}`)
  }, [searchParams, params])

  return (
    <Drawer
      open={open}
      onTransitionExited={removeUrlParams}
      onClose={setOpen.off}
      {...others}
    >
      {
        <>
          {requiredArePresent &&
            children?.({
              params: childParams as Record<K, string>,
              closeDrawer: setOpen.off,
            })}
          {!hideCloseButton && (
            <CloseButton
              variant="text"
              size="medium"
              onClick={setOpen.off}
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
