"use client"

import React, { useEffect } from "react"
import { styled } from "@pigment-css/react"
import { default as MuiAlert, AlertColor } from "@mui/material/Alert"
import { theme } from "../theme/theme"
import type { AlertProps as MuiAlertProps } from "@mui/material/Alert"

type Colors = {
  [_Severity in AlertColor]: string
}

type Severities = {
  [Key in AlertColor as Capitalize<Key>]: Key
}

const Severities: Severities = {
  Success: "success",
  Info: "info",
  Warning: "warning",
  Error: "error",
}

const COLORS: Colors = {
  info: theme.custom.colors.blue,
  success: theme.custom.colors.green,
  warning: theme.custom.colors.orange,
  error: theme.custom.colors.lightRed,
}

type AlertStyleProps = {
  severity: AlertColor
}

const AlertStyled = styled(MuiAlert)<AlertStyleProps>({
  padding: "11px 16px",
  borderRadius: 4,
  borderWidth: 2,
  borderStyle: "solid",
  background: "#FFF",
  ".MuiAlert-message": {
    ...theme.typography.body2,
    color: theme.custom.colors.darkGray2,
  },
  "> div": {
    paddingTop: 0,
    paddingBottom: 0,
  },
  ".MuiAlert-icon": {
    marginRight: 8,
    svg: {
      width: 16,
    },
  },
  button: {
    padding: 0,
    ":hover": {
      margin: 0,
      background: "none",
    },
  },
  variants: [
    Severities.Success,
    Severities.Info,
    Severities.Warning,
    Severities.Error,
  ].map((severity) => ({
    props: { severity },
    style: {
      borderColor: COLORS[severity],
      ".MuiAlert-icon": {
        marginRight: 8,
        svg: {
          fill: severity,
        },
      },
    },
  })),
})

const Hidden = styled("span")({ display: "none" })

type AlertProps = {
  visible?: boolean
  closable?: boolean
  className?: string
} & Pick<MuiAlertProps, "severity" | "children">

const Alert: React.FC<AlertProps> = ({
  visible = true,
  severity = "info",
  closable,
  children,
  className,
}) => {
  const [_visible, setVisible] = React.useState(visible)
  const id = React.useId()
  const onCloseClick = () => {
    setVisible(false)
  }

  useEffect(() => {
    setVisible(visible)
  }, [visible])

  if (!_visible) {
    return null
  }

  return (
    <AlertStyled
      severity={severity!}
      onClose={closable ? onCloseClick : undefined}
      role="alert"
      aria-describedby={id}
      className={className}
    >
      {children}
      <Hidden id={id}>{severity} message</Hidden>
    </AlertStyled>
  )
}

export { Alert }
export type { AlertProps }
