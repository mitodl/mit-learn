import React from "react"
import { styled } from "@pigment-css/react"
// import { pxToRem } from "../theme/typography"
import tinycolor from "tinycolor2"
import Link from "next/link"

type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "bordered"
  | "noBorder"
  | "inverted"
  | "success"
  | "text"
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
  color?: "secondary"
}

const styleProps: Record<string, boolean> = {
  variant: true,
  size: true,
  edge: true,
  startIcon: true,
  endIcon: true,
  responsive: true,
  color: true,
} satisfies Record<keyof ButtonStyleProps, boolean>

const shouldForwardProp = (prop: string) => !styleProps[prop]

const DEFAULT_PROPS: Required<
  Omit<ButtonStyleProps, "startIcon" | "endIcon" | "color">
> = {
  variant: "primary",
  size: "medium",
  edge: "rounded",
  responsive: false,
}

const BORDER_WIDTHS = {
  small: 1,
  medium: 1,
  large: 2,
}

const RESPONSIVE_SIZES: Record<ButtonSize, ButtonSize> = {
  small: "small",
  medium: "small",
  large: "medium",
}

const ButtonStyled = styled("button", { shouldForwardProp })<
  ButtonStyleProps & { hasBorder?: boolean }
>(({ theme }) => ({
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

  // Size styles
  padding: ({ size, hasBorder }) => {
    const paddingAdjust = hasBorder ? BORDER_WIDTHS[size || "medium"] : 0
    if (size === "large") return `${14 - paddingAdjust}px 24px`
    if (size === "small") return `${8 - paddingAdjust}px 12px`
    return `${11 - paddingAdjust}px 16px`
  },

  variants: [
    // {
    //   props: { responsive: true },
    //   style: {
    //     [theme.breakpoints.down("sm")]: {
    //       // TODO pigment: This produces an error in the build output, possibly nesting here
    //       padding: ({ size, hasBorder }) => {
    //         const paddingAdjust = hasBorder
    //           ? BORDER_WIDTHS[size || "medium"]
    //           : 0
    //         if (size === "large") return `${14 - paddingAdjust}px 24px`
    //         if (size === "small") return `${8 - paddingAdjust}px 12px`
    //         return `${11 - paddingAdjust}px 16px`
    //       },
    //     },
    //   },
    // },
    {
      props: { size: "large" },
      style: theme.typography.buttonLarge,
    },
    {
      props: { size: "medium" },
      style: theme.typography.button,
    },
    {
      props: { size: "small" },
      style: theme.typography.buttonSmall,
    },
    {
      props: { size: "large", responsive: true },
      style: {
        [theme.breakpoints.down("sm")]: theme.typography.buttonLarge,
      },
    },
    {
      props: { size: "medium", responsive: true },
      style: {
        [theme.breakpoints.down("sm")]: theme.typography.button,
      },
    },
    {
      props: { size: "small", responsive: true },
      style: {
        [theme.breakpoints.down("sm")]: theme.typography.buttonSmall,
      },
    },
    {
      props: { variant: "primary" },
      style: {
        backgroundColor: theme.custom.colors.mitRed,
        color: theme.custom.colors.white,
        border: "none",
        /* Shadow/04dp */
        boxShadow:
          "0px 2px 4px 0px rgba(37, 38, 43, 0.10), 0px 3px 8px 0px rgba(37, 38, 43, 0.12)",
        ":hover:not(:disabled)": {
          backgroundColor: theme.custom.colors.red,
          boxShadow: "none",
        },
        ":disabled": {
          backgroundColor: theme.custom.colors.silverGray,
          boxShadow: "none",
        },
      },
    },
    {
      props: { variant: "success" },
      style: {
        backgroundColor: theme.custom.colors.darkGreen,
        color: theme.custom.colors.white,
        border: "none",
        /* Shadow/04dp */
        boxShadow:
          "0px 2px 4px 0px rgba(37, 38, 43, 0.10), 0px 3px 8px 0px rgba(37, 38, 43, 0.12)",
        ":hover:not(:disabled)": {
          backgroundColor: theme.custom.colors.darkGreen,
          boxShadow: "none",
        },
        ":disabled": {
          backgroundColor: theme.custom.colors.silverGray,
          boxShadow: "none",
        },
      },
    },
    {
      props: { variant: "secondary" },
      style: {
        color: theme.custom.colors.red,
        backgroundColor: "transparent",
        borderColor: "currentcolor",
        borderStyle: "solid",
        ":hover:not(:disabled)": {
          backgroundColor: tinycolor(theme.custom.colors.brightRed)
            .setAlpha(0.06)
            .toString(),
        },
        ":disabled": {
          color: theme.custom.colors.silverGray,
        },
      },
    },
    {
      props: { variant: "text" },
      style: {
        backgroundColor: "transparent",
        borderStyle: "none",
        color: theme.custom.colors.darkGray2,
        ":hover:not(:disabled)": {
          backgroundColor: tinycolor(theme.custom.colors.darkGray1)
            .setAlpha(0.06)
            .toString(),
        },
        ":disabled": {
          color: theme.custom.colors.silverGray,
        },
      },
    },
    {
      props: { variant: "bordered" },
      style: {
        backgroundColor: theme.custom.colors.white,
        color: theme.custom.colors.silverGrayDark,
        border: `1px solid ${theme.custom.colors.silverGrayLight}`,
        ":hover:not(:disabled)": {
          backgroundColor: theme.custom.colors.lightGray1,
          color: theme.custom.colors.darkGray2,
        },
        ":disabled": {
          backgroundColor: theme.custom.colors.lightGray2,
          border: `1px solid ${theme.custom.colors.lightGray2}`,
          color: theme.custom.colors.silverGrayDark,
        },
      },
    },
    {
      props: { variant: "noBorder" },
      style: {
        backgroundColor: theme.custom.colors.white,
        color: theme.custom.colors.darkGray2,
        border: "none",
        ":hover:not(:disabled)": {
          backgroundColor: tinycolor(theme.custom.colors.darkGray1)
            .setAlpha(0.06)
            .toString(),
        },
        ":disabled": {
          color: theme.custom.colors.silverGray,
        },
      },
    },
    {
      props: { variant: "tertiary" },
      style: {
        color: theme.custom.colors.darkGray2,
        border: "none",
        backgroundColor: theme.custom.colors.lightGray2,
        ":hover:not(:disabled)": {
          backgroundColor: theme.custom.colors.white,
        },
        ":disabled": {
          backgroundColor: theme.custom.colors.lightGray2,
          color: theme.custom.colors.silverGrayLight,
        },
      },
    },
    {
      props: { variant: "inverted" },
      style: {
        backgroundColor: theme.custom.colors.white,
        color: theme.custom.colors.mitRed,
        borderColor: theme.custom.colors.mitRed,
        borderStyle: "solid",
      },
    },
    {
      props: { edge: "rounded" },
      style: {
        borderRadius: "4px",
      },
    },
    {
      props: { edge: "circular" },
      style: {
        // Pill-shaped buttons... Overlapping border radius get clipped to pill.
        borderRadius: "100vh",
      },
    },
    {
      props: { color: "secondary" },
      style: {
        color: theme.custom.colors.silverGray,
        borderColor: theme.custom.colors.silverGray,
        ":hover:not(:disabled)": {
          backgroundColor: theme.custom.colors.lightGray1,
        },
      },
    },
  ],
}))

// const AnchorStyled = styled("a", { shouldForwardProp })<ButtonStyleProps>(
//   buildStyles,
// )
// const AnchorStyled: React.FC<ButtonStyleProps> = (props) => {
//   return <ButtonStyled as="a" {...props} />
// }

// const LinkStyled: React.FC<ButtonStyleProps> = (props) => {
//   return <ButtonStyled as={Link} {...props} />
// }
// TODO pigment: Pull out style fn so we're not repeating
const LinkStyled = styled(Link, { shouldForwardProp })<
  ButtonStyleProps & { hasBorder?: boolean }
>(({ theme }) => ({
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

  // Size styles
  padding: ({ size, hasBorder }) => {
    const paddingAdjust = hasBorder ? BORDER_WIDTHS[size || "medium"] : 0
    if (size === "large") return `${14 - paddingAdjust}px 24px`
    if (size === "small") return `${8 - paddingAdjust}px 12px`
    return `${11 - paddingAdjust}px 16px`
  },

  variants: [
    // {
    //   props: { responsive: true },
    //   style: {
    //     [theme.breakpoints.down("sm")]: {
    //       // TODO pigment: This produces an error in the build output, possibly styling based on runtime values isn't support in nested variants
    // Cannot access 't' before initialization
    // at h.vars.bcdo3jh-1 (/Users/jk/mit/mit-open/frontends/main/.next/server/chunks/821.js:1:91850)
    //       padding: ({ size, hasBorder }) => {
    //         const paddingAdjust = hasBorder
    //           ? BORDER_WIDTHS[size || "medium"]
    //           : 0
    //         if (size === "large") return `${14 - paddingAdjust}px 24px`
    //         if (size === "small") return `${8 - paddingAdjust}px 12px`
    //         return `${11 - paddingAdjust}px 16px`
    //       },
    //     },
    //   },
    // },
    {
      props: { size: "large" },
      style: theme.typography.buttonLarge,
    },
    {
      props: { size: "medium" },
      style: theme.typography.button,
    },
    {
      props: { size: "small" },
      style: theme.typography.buttonSmall,
    },
    {
      props: { size: "large", responsive: true },
      style: {
        [theme.breakpoints.down("sm")]: theme.typography.buttonLarge,
      },
    },
    {
      props: { size: "medium", responsive: true },
      style: {
        [theme.breakpoints.down("sm")]: theme.typography.button,
      },
    },
    {
      props: { size: "small", responsive: true },
      style: {
        [theme.breakpoints.down("sm")]: theme.typography.buttonSmall,
      },
    },
    {
      props: { variant: "primary" },
      style: {
        backgroundColor: theme.custom.colors.mitRed,
        color: theme.custom.colors.white,
        border: "none",
        /* Shadow/04dp */
        boxShadow:
          "0px 2px 4px 0px rgba(37, 38, 43, 0.10), 0px 3px 8px 0px rgba(37, 38, 43, 0.12)",
        ":hover:not(:disabled)": {
          backgroundColor: theme.custom.colors.red,
          boxShadow: "none",
        },
        ":disabled": {
          backgroundColor: theme.custom.colors.silverGray,
          boxShadow: "none",
        },
      },
    },
    {
      props: { variant: "success" },
      style: {
        backgroundColor: theme.custom.colors.darkGreen,
        color: theme.custom.colors.white,
        border: "none",
        /* Shadow/04dp */
        boxShadow:
          "0px 2px 4px 0px rgba(37, 38, 43, 0.10), 0px 3px 8px 0px rgba(37, 38, 43, 0.12)",
        ":hover:not(:disabled)": {
          backgroundColor: theme.custom.colors.darkGreen,
          boxShadow: "none",
        },
        ":disabled": {
          backgroundColor: theme.custom.colors.silverGray,
          boxShadow: "none",
        },
      },
    },
    {
      props: { variant: "secondary" },
      style: {
        color: theme.custom.colors.red,
        backgroundColor: "transparent",
        borderColor: "currentcolor",
        borderStyle: "solid",
        ":hover:not(:disabled)": {
          backgroundColor: tinycolor(theme.custom.colors.brightRed)
            .setAlpha(0.06)
            .toString(),
        },
        ":disabled": {
          color: theme.custom.colors.silverGray,
        },
      },
    },
    {
      props: { variant: "text" },
      style: {
        backgroundColor: "transparent",
        borderStyle: "none",
        color: theme.custom.colors.darkGray2,
        ":hover:not(:disabled)": {
          backgroundColor: tinycolor(theme.custom.colors.darkGray1)
            .setAlpha(0.06)
            .toString(),
        },
        ":disabled": {
          color: theme.custom.colors.silverGray,
        },
      },
    },
    {
      props: { variant: "bordered" },
      style: {
        backgroundColor: theme.custom.colors.white,
        color: theme.custom.colors.silverGrayDark,
        border: `1px solid ${theme.custom.colors.silverGrayLight}`,
        ":hover:not(:disabled)": {
          backgroundColor: theme.custom.colors.lightGray1,
          color: theme.custom.colors.darkGray2,
        },
        ":disabled": {
          backgroundColor: theme.custom.colors.lightGray2,
          border: `1px solid ${theme.custom.colors.lightGray2}`,
          color: theme.custom.colors.silverGrayDark,
        },
      },
    },
    {
      props: { variant: "noBorder" },
      style: {
        backgroundColor: theme.custom.colors.white,
        color: theme.custom.colors.darkGray2,
        border: "none",
        ":hover:not(:disabled)": {
          backgroundColor: tinycolor(theme.custom.colors.darkGray1)
            .setAlpha(0.06)
            .toString(),
        },
        ":disabled": {
          color: theme.custom.colors.silverGray,
        },
      },
    },
    {
      props: { variant: "tertiary" },
      style: {
        color: theme.custom.colors.darkGray2,
        border: "none",
        backgroundColor: theme.custom.colors.lightGray2,
        ":hover:not(:disabled)": {
          backgroundColor: theme.custom.colors.white,
        },
        ":disabled": {
          backgroundColor: theme.custom.colors.lightGray2,
          color: theme.custom.colors.silverGrayLight,
        },
      },
    },
    {
      props: { variant: "inverted" },
      style: {
        backgroundColor: theme.custom.colors.white,
        color: theme.custom.colors.mitRed,
        borderColor: theme.custom.colors.mitRed,
        borderStyle: "solid",
      },
    },
    {
      props: { edge: "rounded" },
      style: {
        borderRadius: "4px",
      },
    },
    {
      props: { edge: "circular" },
      style: {
        // Pill-shaped buttons... Overlapping border radius get clipped to pill.
        borderRadius: "100vh",
      },
    },
    {
      props: { color: "secondary" },
      style: {
        color: theme.custom.colors.silverGray,
        borderColor: theme.custom.colors.silverGray,
        ":hover:not(:disabled)": {
          backgroundColor: theme.custom.colors.lightGray1,
        },
      },
    },
  ],
}))

const IconContainer = styled("span")<{
  side: "start" | "end"
  size: ButtonSize
}>({
  height: "1em",
  display: "flex",
  alignItems: "center",
  "& svg, & .MuiSvgIcon-root": {
    width: "1em",
    height: "1em",
    // TODO pigment typography not defined?
    // fontSize: ({ size }) =>
    //   pxToRem(
    //     {
    //       small: 16,
    //       medium: 20,
    //       large: 24,
    //     }[size],
    //   ),
  },
  variants: [
    {
      props: { side: "start" },
      style: {
        /**
         * The negative margin is to counteract the padding on the button itself.
         * Without icons, the left space is 24/16/12 px.
         * With icons, the left space is 20/12/8 px.
         */
        marginLeft: "-4px",
        marginRight: "8px",
      },
    },
    {
      props: { side: "end" },
      style: {
        marginLeft: "8px",
        marginRight: "-4px",
      },
    },
  ],
})

const ButtonInner: React.FC<
  ButtonStyleProps & { children?: React.ReactNode }
> = (props) => {
  const { children, size = DEFAULT_PROPS.size } = props
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

type ButtonProps = ButtonStyleProps & React.ComponentProps<"button">

/**
 * Our styled button. If you need a link that looks like a button, use ButtonLink
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, ...props }, ref) => {
    return (
      <ButtonStyled ref={ref} type="button" {...props}>
        <ButtonInner {...props}>{children}</ButtonInner>
      </ButtonStyled>
    )
  },
)

type ButtonLinkProps = ButtonStyleProps &
  Omit<React.ComponentProps<typeof Link>, "as"> & {
    rawAnchor?: boolean
    href: string
  }

const ButtonLink = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ children, rawAnchor, ...props }: ButtonLinkProps, ref) => {
    // const Component = rawAnchor ? AnchorStyled : LinkStyled
    // return (
    //   <Component ref={ref} {...props}>
    //     <ButtonInner {...props}>{children}</ButtonInner>
    //   </Component>
    // )
    // TODO pigment: reinstate rawAnchor (fix ref type)
    return (
      <LinkStyled ref={ref} {...props}>
        <ButtonInner {...props}>{children}</ButtonInner>
      </LinkStyled>
    )
  },
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
      // TODO pigment typography not defined?
      // fontSize: pxToRem(
      //   {
      //     small: 20,
      //     medium: 24,
      //     large: 32,
      //   }[size],
      // ),
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
)(({ theme }) => ({
  // TODO pigment confirm that this provides the default "medium", with variants below overriding
  ...actionStyles("medium"),
  variants: [
    {
      props: { size: "small" },
      style: actionStyles("small"),
    },
    {
      props: { size: "large" },
      style: actionStyles("large"),
    },
    {
      props: { size: "small", responsive: true },
      style: {
        [theme.breakpoints.down("sm")]: actionStyles(RESPONSIVE_SIZES["small"]),
      },
    },
    {
      props: { size: "medium", responsive: true },
      style: {
        [theme.breakpoints.down("sm")]: actionStyles(
          RESPONSIVE_SIZES["medium"],
        ),
      },
    },
    {
      props: { size: "large", responsive: true },
      style: {
        [theme.breakpoints.down("sm")]: actionStyles(RESPONSIVE_SIZES["large"]),
      },
    },
  ],
}))

type ActionButtonLinkProps = ActionButtonProps &
  Omit<React.ComponentProps<typeof Link>, "as"> & {
    rawAnchor?: boolean
    href: string
  }

const ActionButtonLink: React.FC<ActionButtonLinkProps> = ({
  rawAnchor,
  href,
  ...props
}) => {
  const Component = rawAnchor ? "a" : Link
  return <Component href={href} {...props} />
}

ActionButtonLink.displayName = "ActionButtonLink"

export { Button, ButtonLink, ActionButton, ActionButtonLink }

export type {
  ButtonProps,
  ButtonLinkProps,
  ActionButtonProps,
  ActionButtonLinkProps,
}
