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
} from "next/navigation"
import { useToggle } from "ol-utilities"

const closeSx: React.CSSProperties = {
  position: "absolute",
  top: "16px",
  right: "22px",
}

const CloseIcon = styled(RiCloseLargeLine)`
  &&& {
    width: 18px;
    height: 18px;
  }
`

type ChildParams<K extends string, R extends K> = Record<K, string | null> &
  Record<R, string>

type RoutedDrawerProps<K extends string = string, R extends K = K> = {
  params?: readonly K[]
  requiredParams: readonly R[]
  onView?: () => void
  children: (childProps: {
    params: ChildParams<K, R>
    closeDrawer: () => void
  }) => React.ReactNode
} & Omit<DrawerProps, "open" | "onClose" | "children">

const RoutedDrawer = <K extends string, R extends K = K>(
  props: RoutedDrawerProps<K, R>,
) => {
  const { requiredParams, children, onView, ...others } = props
  const { params = requiredParams } = props

  const [open, setOpen] = useToggle(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  const childParams = useMemo(() => {
    return Object.fromEntries(
      params.map((name) => [name, searchParams.get(name)] as const),
    ) as Record<K, string | null>
  }, [searchParams, params])

  /**
   * `requiredArePresnet` and `open` are usually the same, except when the
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

    // Note that { scroll: true } and { scroll: false } both remove the hash fragment
    if (hash) {
      router.push(`?${newParams}${hash}`)
    } else {
      // Prevent scroll to top of page
      router.push(`?${newParams}`, { scroll: false })
    }
  }, [router, searchParams, params])

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
          <ActionButton
            style={closeSx}
            variant="text"
            size="medium"
            onClick={setOpen.off}
            aria-label="Close"
          >
            <CloseIcon />
          </ActionButton>
        </>
      }
    </Drawer>
  )
}

export { RoutedDrawer }
export type { RoutedDrawerProps }
