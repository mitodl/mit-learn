import React from "react"
import { styled } from "@pigment-css/react"
import { theme } from "../theme/theme"
import InputBase from "@mui/material/InputBase"
import type { InputBaseProps } from "@mui/material/InputBase"
import ClassNames from "classnames"

type Size = NonNullable<InputBaseProps["size"]>

const responsiveSize: Record<Size, Size> = {
  small: "small",
  medium: "small",
  large: "medium",
  hero: "large",
}

type SizeStyleProps = {
  size: Size
  multiline?: boolean
}

const sizeStyles = ({ size, multiline }: SizeStyleProps) => {
  return Object.assign(
    {},
    (size === "small" || size === "medium") &&
      {
        // TODO pigment
        // ...theme.typography.body2,
      },
    (size === "large" || size === "hero") && {
      ".remixicon": {
        width: "24px",
        height: "24px",
      },
      // TODO pigment
      // ...theme.typography.body1,
    },
    size === "medium" && {
      paddingLeft: "12px",
      paddingRight: "12px",
    },
    size === "small" &&
      !multiline && {
        height: "32px",
      },
    size === "medium" &&
      !multiline && {
        height: "40px",
      },
    size === "large" &&
      !multiline && {
        height: "48px",
      },
    size === "hero" &&
      !multiline && {
        height: "72px",
      },
    size === "small" && {
      padding: "0 8px",
      ".Mit-AdornmentButton": {
        width: "32px",
        ".remixicon": {
          width: "16px",
          height: "16px",
        },
      },
    },
    size === "medium" && {
      padding: "0 12px",
      ".Mit-AdornmentButton": {
        width: "40px",
        ".remixicon": {
          width: "20px",
          height: "20px",
        },
      },
    },
    size === "large" && {
      padding: "0 16px",
      ".Mit-AdornmentButton": {
        width: "48px",
      },
    },
    size === "hero" && {
      padding: "0 24px",
      ".Mit-AdornmentButton": {
        width: "72px",
      },
    },
  )
}

/**
 * Base styles for Input and Select components. Includes border, color, hover effects.
 */
const baseInputStyles = {
  backgroundColor: "white",
  color: theme.custom.colors.darkGray2,
  borderColor: theme.custom.colors.silverGrayLight,
  borderWidth: "1px",
  borderStyle: "solid",
  borderRadius: "4px",
  "&.Mui-disabled": {
    backgroundColor: theme.custom.colors.lightGray1,
  },
  "&:hover:not(.Mui-disabled):not(.Mui-focused)": {
    borderColor: theme.custom.colors.darkGray2,
  },
  "&.Mui-focused": {
    /**
     * When change border width, it affects either the elements outside of it or
     * inside based on the border-box setting.
     *
     * Instead of changing the border width, we hide the border and change width
     * using outline.
     */
    borderColor: "transparent",
    outline: "2px solid currentcolor",
    outlineOffset: "-2px",
  },
  "&.Mui-error": {
    borderColor: theme.custom.colors.red,
    outlineColor: theme.custom.colors.red,
  },
  "& input::placeholder, textarea::placeholder": {
    color: theme.custom.colors.silverGrayDark,
    opacity: 1, // some browsers apply opacity to placeholder text
  },
  "& input:placeholder-shown, textarea:placeholder-shown": {
    textOverflow: "ellipsis",
  },
  "& textarea": {
    paddingTop: "8px",
    paddingBottom: "8px",
  },
  "&.MuiInputBase-adornedStart": {
    paddingLeft: "0",
    input: {
      paddingLeft: "8px",
    },
  },
  "&.MuiInputBase-adornedEnd": {
    paddingRight: "0",
    input: {
      paddingRight: "8px",
    },
  },
}

/**
 * A styled input that supports start and end adornments. In most cases, the
 * higher-level TextField component should be used instead of this component.
 */
type CustomInputProps = { responsive?: true }
const noForward = Object.keys({
  responsive: true,
} satisfies { [_key in keyof CustomInputProps]: boolean })

// TODO pigment: default size = medium
const Input = styled(InputBase, {
  shouldForwardProp: (prop) => !noForward.includes(prop),
})<InputBaseProps & { responsive?: true }>(({ theme }) => ({
  ...baseInputStyles,
  height: ({ size, multiline }) => {
    if (size === "small" && !multiline) return "32px"
    if (size === "medium" && !multiline) return "40px"
    if (size === "large" && !multiline) return "48px"
    if (size === "hero" && !multiline) return "72px"
    return "auto"
  },
  variants: [
    {
      props: { size: "small" },
      style: sizeStyles({ size: "small" }),
    },
    {
      props: { size: "medium" },
      style: sizeStyles({ size: "medium" }),
    },
    {
      props: { size: "large" },
      style: sizeStyles({ size: "large" }),
    },
    {
      props: { size: "hero" },
      style: sizeStyles({ size: "hero" }),
    },
    {
      props: { size: "small", multiline: true },
      style: sizeStyles({ size: "small", multiline: true }),
    },
    {
      props: { size: "medium", multiline: true },
      style: sizeStyles({ size: "medium", multiline: true }),
    },
    {
      props: { size: "large", multiline: true },
      style: sizeStyles({ size: "large", multiline: true }),
    },
    {
      props: { size: "hero", multiline: true },
      style: sizeStyles({ size: "hero", multiline: true }),
    },
    {
      props: { size: "small", responsive: true },
      style: {
        [theme.breakpoints.down("sm")]: sizeStyles({
          size: responsiveSize["small"],
        }),
      },
    },
    {
      props: { size: "medium", responsive: true },
      style: {
        [theme.breakpoints.down("sm")]: sizeStyles({
          size: responsiveSize["medium"],
        }),
      },
    },
    {
      props: { size: "large", responsive: true },
      style: {
        [theme.breakpoints.down("sm")]: sizeStyles({
          size: responsiveSize["large"],
        }),
      },
    },
    {
      props: { size: "hero", responsive: true },
      style: {
        [theme.breakpoints.down("sm")]: sizeStyles({
          size: responsiveSize["hero"],
        }),
      },
    },
    {
      props: { size: "small", responsive: true, multiline: true },
      style: {
        [theme.breakpoints.down("sm")]: sizeStyles({
          size: responsiveSize["small"],
          multiline: true,
        }),
      },
    },
    {
      props: { size: "medium", responsive: true, multiline: true },
      style: {
        [theme.breakpoints.down("sm")]: sizeStyles({
          size: responsiveSize["medium"],
          multiline: true,
        }),
      },
    },
    {
      props: { size: "large", responsive: true, multiline: true },
      style: {
        [theme.breakpoints.down("sm")]: sizeStyles({
          size: responsiveSize["large"],
          multiline: true,
        }),
      },
    },
    {
      props: { size: "hero", responsive: true, multiline: true },
      style: {
        [theme.breakpoints.down("sm")]: sizeStyles({
          size: responsiveSize["hero"],
          multiline: true,
        }),
      },
    },
  ],
}))

const AdornmentButtonStyled = styled("button")(({ theme }) => ({
  // font
  ...theme.typography.button,
  // display
  display: "flex",
  flexShrink: 0,
  justifyContent: "center",
  alignItems: "center",
  // background and border
  border: "none",
  background: "transparent",
  transition: `background ${theme.transitions.duration.short}ms`,
  // cursor
  cursor: "pointer",
  ":disabled": {
    cursor: "default",
  },
  ":hover": {
    background: "rgba(0, 0, 0, 0.06)",
  },
  color: theme.custom.colors.silverGray,
  ".MuiInputBase-root:hover &": {
    color: "inherit",
  },
  ".MuiInputBase-root.Mui-focused &": {
    color: "inherit",
  },
  ".MuiInputBase-root.Mui-disabled &": {
    color: "inherit",
  },
  height: "100%",
}))

const noFocus: React.MouseEventHandler = (e) => e.preventDefault()

type AdornmentButtonProps = React.ComponentProps<typeof AdornmentButtonStyled>
/**
 * Button to be used with `startAdornment` and `endAdornment` props on Input and
 * TextField components. AdornmentButton takes care of positioning and other
 * styling concerns.
 *
 * NOTES:
 *  - It is generally expected that the content of the AdornmentButton is a
 *    Remix Icon component. https://remixicon.com/
 *  - By default, the AdornmentButton calls `preventDefault` on `mouseDown`
 *    events. This prevents the button from stealing focus from the input on
 *    click. The button is still focusable via keyboard events. You can override
 *    this behavior by passing your own `onMouseDown` handler.
 */
const AdornmentButton: React.FC<AdornmentButtonProps> = ({
  className,
  ...others
}) => {
  return (
    <AdornmentButtonStyled
      /**
       * If the input is focused and user clicks the AdornmentButton, we don't
       * want to steal focus from the input.
       */
      onMouseDown={noFocus}
      className={ClassNames("Mit-AdornmentButton", className)}
      {...others}
    />
  )
}

type InputProps = Omit<InputBaseProps, "color"> & CustomInputProps

export { AdornmentButton, Input, baseInputStyles }
export type { InputProps, AdornmentButtonProps }
