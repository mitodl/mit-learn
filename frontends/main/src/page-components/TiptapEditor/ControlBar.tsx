import React, {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { cn } from "./vendor/lib/tiptap-utils"
import { useMenuNavigation } from "./vendor/hooks/use-menu-navigation"
import { useComposedRef } from "./vendor/hooks/use-composed-ref"
import "./vendor/components/tiptap-ui-primitive/toolbar/toolbar.scss"

/**
 * The editor's control bar: the vendor `Toolbar` in markup, styling and
 * keyboard behaviour, and ours in one respect.
 *
 * The vendor component sets fresh state for every childList change in its own
 * subtree, which keeps the list honest for a bar whose children are all
 * controls. Ours also holds the status line, the autosave indicator and the
 * publish controls, and text coming and going between the buttons is not a
 * change to the buttons -- so an indicator swapping "Saving..." for "Saved"
 * re-rendered the bar and re-bound its key handler for nothing.
 *
 * It also put the bar's state updates out of reach of tests. An observer
 * callback runs in a microtask of its own, and React's synchronous `act`
 * clears its queue as soon as the commit that caused the mutation returns, so
 * an update from one of these lands with no scope open and fails whichever
 * suite happened to trigger it.
 *
 * Holding the same array when the controls have not changed settles both: the
 * list stays as fresh as it was, and React bails out before scheduling
 * anything when there is nothing new in it. A mutation that does change the
 * controls still updates, as it has to: a publish mounts a spinner inside the
 * Publish button and disables it in the same render, so the bar is told about
 * a childList change and loses a control at once. What goes away is being
 * told about a change to something that is not a control at all, which is
 * every autosave.
 *
 * One deliberate difference in behaviour, for anyone who has arrow-keyed
 * within the bar. `selectedIndex` starts at -1 and is only ever set by
 * keyboard navigation in here, so until that happens the focus effect below
 * has nothing to focus. Once it is set, the vendor component's new array on
 * every mutation re-ran that effect and pulled focus back to the selected
 * control -- out of the editor body, if that is where it had gone. Bailing
 * out leaves focus where the author put it.
 *
 * Lives outside `vendor` deliberately -- see `vendor/README.md`, which keeps
 * ejected library code unedited so it can be re-ejected.
 */

type BaseProps = React.HTMLAttributes<HTMLDivElement>

interface ControlBarProps extends BaseProps {
  variant?: "floating" | "fixed"
}

const useControlBarNavigation = (
  barRef: React.RefObject<HTMLDivElement | null>,
) => {
  const [items, setItems] = useState<HTMLElement[]>([])

  const collectItems = useCallback(() => {
    if (!barRef.current) return []
    return Array.from(
      barRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [role="button"]:not([disabled]), [tabindex="0"]:not([disabled])',
      ),
    )
  }, [barRef])

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return

    const updateItems = () =>
      setItems((previous) => {
        const next = collectItems()
        return previous.length === next.length &&
          previous.every((item, i) => item === next[i])
          ? previous
          : next
      })

    updateItems()
    const observer = new MutationObserver(updateItems)
    observer.observe(bar, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [collectItems, barRef])

  const { selectedIndex } = useMenuNavigation<HTMLElement>({
    containerRef: barRef,
    items,
    orientation: "horizontal",
    onSelect: (el) => el.click(),
    autoSelectFirstItem: false,
  })

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return

    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      if (bar.contains(target))
        target.setAttribute("data-focus-visible", "true")
    }

    const handleBlur = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      if (bar.contains(target)) target.removeAttribute("data-focus-visible")
    }

    bar.addEventListener("focus", handleFocus, true)
    bar.addEventListener("blur", handleBlur, true)

    return () => {
      bar.removeEventListener("focus", handleFocus, true)
      bar.removeEventListener("blur", handleBlur, true)
    }
  }, [barRef])

  useEffect(() => {
    if (selectedIndex !== undefined && items[selectedIndex]) {
      items[selectedIndex].focus()
    }
  }, [selectedIndex, items])
}

export const ControlBar = forwardRef<HTMLDivElement, ControlBarProps>(
  ({ children, className, variant = "fixed", ...props }, ref) => {
    const barRef = useRef<HTMLDivElement>(null)
    const composedRef = useComposedRef(barRef, ref)
    useControlBarNavigation(barRef)

    return (
      <div
        ref={composedRef}
        role="toolbar"
        aria-label="toolbar"
        data-variant={variant}
        className={cn("tiptap-toolbar", className)}
        {...props}
      >
        {children}
      </div>
    )
  },
)
ControlBar.displayName = "ControlBar"
