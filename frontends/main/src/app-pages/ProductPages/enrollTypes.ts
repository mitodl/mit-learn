import React from "react"

// "free" covers every non-paid enrollment — active audit ("Start Learning") and
// the degraded archived/deadline-passed audit ("Access Course Materials"). They
// hit the same free-enrollment path; only the button label differs.
export type EnrollActionKind = "paid" | "free"

export type EnrollAction = {
  kind: EnrollActionKind
  label: string
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

// Discriminated — "enrolled" is the collapse state, not an "option"; "none" = no button.
export type EnrollAreaState =
  | { status: "enrolled"; href: string }
  | { status: "options"; options: EnrollAction[] }
  | { status: "none" }
