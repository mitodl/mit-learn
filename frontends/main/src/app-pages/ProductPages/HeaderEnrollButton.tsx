import React from "react"
import { Alert, Button, styled } from "@mitodl/smoot-design"
import { Stack } from "ol-components"
import { SignupPopover } from "@/page-components/SignupPopover/SignupPopover"
import { EnrollButton } from "./EnrollAreaParts"
import EnrolledLink from "./EnrolledLink"
import { badRequestDetail } from "api/mutation-errors"
import ErrorMessageWithSupport from "@/components/ErrorMessageWithSupport/ErrorMessageWithSupport"
import { ENROLL_FAILURE_MESSAGE } from "./enrollTypes"
import type { EnrollAreaState } from "./enrollTypes"

/**
 * The page-header enroll button uses the `bordered` variant but with darkGray2
 * text (matching production), not the variant's default silverGrayDark. Disabled
 * buttons keep the variant default. `display: contents` adds no layout box.
 */
export const HeaderButtonSlot = styled.div(({ theme }) => ({
  display: "contents",
  "& button:not(:disabled), & a": {
    color: theme.custom.colors.darkGray2,
  },
  // A price range can outgrow one line on mobile; wrap rather than overflow.
  [theme.breakpoints.down("sm")]: {
    "& button": {
      height: "auto",
      minHeight: "48px",
      whiteSpace: "normal",
      textWrap: "balance",
    },
  },
}))

/**
 * The banner's action column is a fixed 240px (sized for a lone CTA button);
 * an alert wrapped to that width becomes a tall, skinny box. Let it size to
 * its message instead — it renders below the button row, so extending past
 * the column is harmless.
 */
const HeaderAlertSizer = styled.div(({ theme }) => ({
  width: "max-content",
  maxWidth: "480px",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    maxWidth: "100%",
  },
}))

/**
 * On mobile the banner button is the primary CTA and spans the column, so it
 * names the price.
 */
const MobilePrice = styled.span(({ theme }) => ({
  [theme.breakpoints.up("sm")]: { display: "none" },
}))

type HeaderEnrollButtonProps = {
  state: EnrollAreaState
  /** The InfoBox's certificate price; appended to a paid action on mobile. */
  price?: string | null
  isStatusLoading: boolean
  isPending: boolean
  /** The failed enroll action's error, or null when there was none. */
  error: unknown
  /** SignupPopover anchor owned by the caller (set via the hook's onRequireSignup). */
  anchor: HTMLButtonElement | null
  onAnchorClose: () => void
}

/**
 * Page-header enroll CTA, shared by course and program product pages. Mirrors
 * the InfoBox's recommended action: the paid/first option, "Enrolled", or a
 * disabled "Enroll" placeholder when nothing is enrollable.
 */
const HeaderEnrollButton: React.FC<HeaderEnrollButtonProps> = ({
  state,
  price,
  isStatusLoading,
  isPending,
  error,
  anchor,
  onAnchorClose,
}) => {
  if (state.status === "enrolled") {
    return (
      <HeaderButtonSlot>
        <EnrolledLink variant="bordered" href={state.href} />
      </HeaderButtonSlot>
    )
  }

  if (state.status === "options") {
    const action = state.options[0]
    const showPrice = action.kind === "paid" && !!price
    return (
      <HeaderButtonSlot>
        <Stack gap="12px" alignItems="flex-start">
          <EnrollButton
            action={action}
            size="large"
            loading={isStatusLoading}
            pending={isPending}
            variant="bordered"
            announceStatus={false}
            labelSuffix={
              showPrice ? <MobilePrice> - {price}</MobilePrice> : null
            }
          />
          {/* This hook instance's mutations are local to the header button, so
              failures must surface here — the InfoBox alert observes its own
              separate mutation instances and never fires for header clicks. */}
          {!!error && (
            <HeaderAlertSizer>
              <Alert severity="error">
                <ErrorMessageWithSupport>
                  {badRequestDetail(error) ?? ENROLL_FAILURE_MESSAGE}
                </ErrorMessageWithSupport>
              </Alert>
            </HeaderAlertSizer>
          )}
        </Stack>
        <SignupPopover anchorEl={anchor} onClose={onAnchorClose} />
      </HeaderButtonSlot>
    )
  }

  // status === "none"
  return (
    <HeaderButtonSlot>
      <Button variant="bordered" size="large" disabled>
        Enroll
      </Button>
    </HeaderButtonSlot>
  )
}

export default HeaderEnrollButton
