import { styled } from "ol-components"

/**
 * The white card the receipt is built from. Shared so the summary, the detail
 * sections and the issuer block stay in step.
 *
 * `cardshadow` in the design system is `0 4px 8px #13141514`.
 */
const ReceiptCard = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  padding: "32px",
  borderRadius: "4px",
  backgroundColor: theme.custom.colors.white,
  boxShadow: "0 4px 8px 0 rgba(19, 20, 21, 0.08)",
  [theme.breakpoints.down("sm")]: {
    gap: "12px",
    padding: "16px",
  },
}))

/**
 * The Order / Customer / Payment cards read as one block: a 1px gap shows the
 * seams while only the outer corners are rounded.
 *
 * Uses `:first-of-type` / `:last-of-type` rather than the child index because a
 * section is omitted entirely when the API supplied none of its fields.
 */
const ReceiptCardStack = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "1px",
  width: "100%",
  "> *": {
    borderRadius: 0,
  },
  "> *:first-of-type": {
    borderTopLeftRadius: "4px",
    borderTopRightRadius: "4px",
  },
  "> *:last-of-type": {
    borderBottomLeftRadius: "4px",
    borderBottomRightRadius: "4px",
  },
})

export { ReceiptCard, ReceiptCardStack }
