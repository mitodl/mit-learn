import React from "react"
import styled from "@emotion/styled"
import { pxToRem } from "../ThemeProvider/typography"
import tinycolor from "tinycolor2"
import Link from "next/link"
import type { Theme } from "@mui/material/styles"

type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "text"
  | "noBorder"
  | "inverted"
  | "success"
type ButtonSize = "small" | "medium" | "large"
type ButtonEdge = "circular" | "rounded" | "none"

type ButtonStyleProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  edge?: ButtonEdge
  startIcon?: React.ReactNode
  endIcon?: React.ReactNode
  /**
   * If true (default: `false`), the button will become one size smaller at the
   * `sm` breakpoint.
   *  - large -> medium
   *  - medium -> small
   *  - small -> small
   */
  responsive?: boolean
}

const styleProps: Record<string, boolean> = {
  variant: true,
  size: true,
  edge: true,
  startIcon: true,
  endIcon: true,
  responsive: true,
} satisfies Record<keyof ButtonStyleProps, boolean>

const shouldForwardProp = (prop: string) => !styleProps[prop]

const defaultProps: Required<Omit<ButtonStyleProps, "startIcon" | "endIcon">> =
  {
    variant: "primary",
    size: "medium",
    edge: "rounded",
    responsive: false,
  }

const borderWidths = {
  small: 1,
  medium: 1,
  large: 2,
}
const responsiveSize: Record<ButtonSize, ButtonSize> = {
  small: "small",
  medium: "small",
  large: "medium",
}

const sizeStyles = (size: ButtonSize, hasBorder: boolean, theme: Theme) => {
  const paddingAdjust = hasBorder ? borderWidths[size] : 0
  return [
    {
      borderWidth: borderWidths[size],
    },
    size === "large" && {
      padding: `${14 - paddingAdjust}px 24px`,
      ...theme.typography.buttonLarge,
    },
    size === "medium" && {
      padding: `${11 - paddingAdjust}px 16px`,
      ...theme.typography.button,
    },
    size === "small" && {
      padding: `${8 - paddingAdjust}px 12px`,
      ...theme.typography.buttonSmall,
    },
  ]
}

const ButtonStyled = styled("button", { shouldForwardProp })<ButtonStyleProps>((
  props,
) => {
  const { size, variant, edge, theme, color, responsive } = {
    ...defaultProps,
    ...props,
  }
  const { colors } = theme.custom
  const hasBorder = variant === "secondary"

  return [
    {
      color: theme.palette.text.primary,
      textAlign: "center",
      // display
      display: "inline-flex",
      justifyContent: "center",
      alignItems: "center",
      // transitions
      transition: `background ${theme.transitions.duration.short}ms`,
      // cursor
      cursor: "pointer",
      ":disabled": {
        cursor: "default",
      },
      minWidth: "100px",
    },
    ...sizeStyles(size, hasBorder, theme),
    // responsive
    responsive && {
      [theme.breakpoints.down("sm")]: sizeStyles(
        responsiveSize[size],
        hasBorder,
        theme,
      ),
    },
    // variant
    variant === "primary" && {
      backgroundColor: colors.mitRed,
      color: colors.white,
      border: "none",
      /* Shadow/04dp */
      boxShadow:
        "0px 2px 4px 0px rgba(37, 38, 43, 0.10), 0px 3px 8px 0px rgba(37, 38, 43, 0.12)",
      ":hover:not(:disabled)": {
        backgroundColor: colors.red,
        boxShadow: "none",
      },
      ":disabled": {
        backgroundColor: colors.silverGray,
        boxShadow: "none",
      },
    },
    hasBorder && {
      backgroundColor: "transparent",
      borderColor: "currentcolor",
      borderStyle: "solid",
    },
    variant === "success" && {
      backgroundColor: colors.darkGreen,
      color: colors.white,
      border: "none",
      /* Shadow/04dp */
      boxShadow:
        "0px 2px 4px 0px rgba(37, 38, 43, 0.10), 0px 3px 8px 0px rgba(37, 38, 43, 0.12)",
      ":hover:not(:disabled)": {
        backgroundColor: colors.darkGreen,
        boxShadow: "none",
      },
      ":disabled": {
        backgroundColor: colors.silverGray,
        boxShadow: "none",
      },
    },
    hasBorder && {
      backgroundColor: "transparent",
      borderColor: "currentcolor",
      borderStyle: "solid",
    },
    variant === "secondary" && {
      color: colors.red,
      ":hover:not(:disabled)": {
        backgroundColor: tinycolor(colors.brightRed).setAlpha(0.06).toString(),
      },
      ":disabled": {
        color: colors.silverGray,
      },
    },
    variant === "text" && {
      backgroundColor: "transparent",
      borderStyle: "none",
      color: colors.darkGray2,
      ":hover:not(:disabled)": {
        backgroundColor: tinycolor(colors.darkGray1).setAlpha(0.06).toString(),
      },
      ":disabled": {
        color: colors.silverGray,
      },
    },
    variant === "noBorder" && {
      backgroundColor: colors.white,
      color: colors.darkGray2,
      border: "none",
      ":hover:not(:disabled)": {
        backgroundColor: tinycolor(colors.darkGray1).setAlpha(0.06).toString(),
      },
      ":disabled": {
        color: colors.silverGray,
      },
    },
    variant === "tertiary" && {
      color: colors.darkGray2,
      border: "none",
      backgroundColor: colors.lightGray2,
      ":hover:not(:disabled)": {
        backgroundColor: colors.white,
      },
      ":disabled": {
        backgroundColor: colors.lightGray2,
        color: colors.silverGrayLight,
      },
    },
    variant === "inverted" && {
      backgroundColor: colors.white,
      color: colors.mitRed,
      borderColor: colors.mitRed,
      borderStyle: "solid",
    },
    // edge
    edge === "rounded" && {
      borderRadius: "4px",
    },
    edge === "circular" && {
      // Pill-shaped buttons... Overlapping border radius get clipped to pill.
      borderRadius: "100vh",
    },
    // color
    color === "secondary" && {
      color: theme.custom.colors.silverGray,
      borderColor: theme.custom.colors.silverGray,
      ":hover:not(:disabled)": {
        backgroundColor: theme.custom.colors.lightGray1,
      },
    },
  ]
})

const IconContainer = styled.span<{ side: "start" | "end"; size: ButtonSize }>(
  ({ size, side }) => [
    {
      height: "1em",
      display: "flex",
      alignItems: "center",
    },
    side === "start" && {
      /**
       * The negative margin is to counteract the padding on the button itself.
       * Without icons, the left space is 24/16/12 px.
       * With icons, the left space is 20/12/8 px.
       */
      marginLeft: "-4px",
      marginRight: "8px",
    },
    side === "end" && {
      marginLeft: "8px",
      marginRight: "-4px",
    },
    {
      "& svg, & .MuiSvgIcon-root": {
        width: "1em",
        height: "1em",
        fontSize: pxToRem(
          {
            small: 16,
            medium: 20,
            large: 24,
          }[size],
        ),
      },
    },
  ],
)

type ButtonProps = ButtonStyleProps & React.ComponentProps<"button">

const ButtonInner: React.FC<
  ButtonStyleProps & { children?: React.ReactNode }
> = (props) => {
  const { children, size = defaultProps.size } = props
  return (
    <>
      {props.startIcon ? (
        <IconContainer size={size} side="start">
          {props.startIcon}
        </IconContainer>
      ) : null}
      {children}
      {props.endIcon ? (
        <IconContainer size={size} side="end">
          {props.endIcon}
        </IconContainer>
      ) : null}
    </>
  )
}

/**
 * Our styled button. If you need a link that looks like a button, use ButtonLink
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, ...props }, ref) => (
    <ButtonStyled ref={ref} type="button" {...props}>
      <ButtonInner {...props}>{children}</ButtonInner>
    </ButtonStyled>
  ),
)

type ButtonLinkProps = ButtonStyleProps &
  Omit<React.ComponentProps<typeof Link>, "as"> & {
    rawAnchor?: boolean
    href: string
  }

const ButtonLink = ButtonStyled.withComponent(
  React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(
    ({ children, rawAnchor, ...props }: ButtonLinkProps, ref) => {
      const Component = rawAnchor ? "a" : Link
      return (
        <Component ref={ref} {...props}>
          <ButtonInner {...props}>{children}</ButtonInner>
        </Component>
      )
    },
  ),
)
ButtonLink.displayName = "ButtonLink"

type ActionButtonProps = Omit<ButtonStyleProps, "startIcon" | "endIcon"> &
  React.ComponentProps<"button">

const actionStyles = (size: ButtonSize) => {
  return {
    minWidth: "auto",
    padding: 0,
    height: {
      small: "32px",
      medium: "40px",
      large: "48px",
    }[size],
    width: {
      small: "32px",
      medium: "40px",
      large: "48px",
    }[size],
    "& svg, & .MuiSvgIcon-root": {
      width: "1em",
      height: "1em",
      fontSize: pxToRem(
        {
          small: 20,
          medium: 24,
          large: 32,
        }[size],
      ),
    },
  }
}

/**
 * A button that should contain a remixicon icon and nothing else.
 * For a variant that functions as a link, see ActionButtonLink.
 */
const ActionButton = styled(
  React.forwardRef<HTMLButtonElement, ActionButtonProps>((props, ref) => (
    <ButtonStyled ref={ref} type="button" {...props} />
  )),
)(({ theme, size = defaultProps.size, responsive }) => {
  return [
    actionStyles(size),
    responsive && {
      [theme.breakpoints.down("sm")]: actionStyles(responsiveSize[size]),
    },
  ]
})

type ActionButtonLinkProps = ActionButtonProps &
  Omit<React.ComponentProps<typeof Link>, "as"> & {
    rawAnchor?: boolean
    href: string
  }
const ActionButtonLink = ActionButton.withComponent(
  ({ rawAnchor, ...props }: ButtonLinkProps) => {
    const Component = rawAnchor ? "a" : Link
    return <Component {...props} />
  },
)
ActionButtonLink.displayName = "ActionButtonLink"

export { Button, ButtonLink, ActionButton, ActionButtonLink }

export type {
  ButtonProps,
  ButtonLinkProps,
  ActionButtonProps,
  ActionButtonLinkProps,
}
