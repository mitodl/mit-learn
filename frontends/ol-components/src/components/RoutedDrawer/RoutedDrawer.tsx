import React, { useCallback, useEffect, useMemo, useRef } from "react"
import Drawer from "@mui/material/Drawer"
import styled from "@emotion/styled"
import type { DrawerProps } from "@mui/material/Drawer"
import { ActionButton } from "../Button/Button"
import { RiCloseLargeLine } from "@remixicon/react"
import {
  useSearchParams,
  useRouter,
  ReadonlyURLSearchParams,
} from "next/navigation"

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
  /**
   * Store the last set of params that includes all required params.
   * That way, when the drawer is closing, its content can still be displayed.
   */
  const lastValidParams = useRef<ChildParams<K, R> | null>(null)

  const { params = requiredParams } = props

  const searchParams = useSearchParams()
  const router = useRouter()

  const isOpen = requiredParams.every((name) => searchParams.get(name) !== null)
  const filteredParams = useMemo(() => {
    return Object.fromEntries(
      params.map((name) => [name, searchParams.get(name)]),
    ) as ChildParams<K, R>
  }, [searchParams, params])
  useEffect(() => {
    if (isOpen) {
      lastValidParams.current = filteredParams
    }
  }, [isOpen, filteredParams])

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

    // Note that { scroll: true } and { scroll: false } both remove the hash fragment
    if (hash) {
      router.push(`?${newParams}${hash}`)
    } else {
      // Prevent scroll to top of page
      router.push(`?${newParams}`, { scroll: false })
    }
  }, [router, searchParams, params])

  const childParams = isOpen ? filteredParams : lastValidParams.current
  return (
    <Drawer open={isOpen} onClose={removeUrlParams} {...others}>
      {
        <>
          {childParams &&
            children?.({
              params: childParams,
              closeDrawer: removeUrlParams,
            })}
          {!hideCloseButton && (
            <CloseButton
              variant="text"
              size="medium"
              onClick={removeUrlParams}
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
