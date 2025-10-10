import React from "react"
import CircularProgress from "@mui/material/CircularProgress"
import Fade from "@mui/material/Fade"
import styled from "@emotion/styled"

const Container = styled.div({
  display: "flex",
  justifyContent: "center",
  alignItems: "center",

  "&.MuiCircularProgress-root": {
    transitionDelay: "800ms",
  },
})

type LoadingSpinnerProps = {
  loading: boolean
  size?: number | string
  "aria-label"?: string
  color?: "primary" | "inherit"
}

const noDelay = { transitionDelay: "0ms" }

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  loading,
  size,
  "aria-label": label = "Loading",
  color,
}) => {
  return (
    <Container>
      <Fade in={loading} style={!loading ? noDelay : undefined} unmountOnExit>
        <CircularProgress color={color} aria-label={label} size={size} />
      </Fade>
    </Container>
  )
}

export { LoadingSpinner }
export type { LoadingSpinnerProps }
