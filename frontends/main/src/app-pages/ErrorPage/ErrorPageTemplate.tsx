import React from "react"
import { Container, Typography, styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import { HOME } from "@/common/urls"

type ErrorPageTemplateProps = {
  title: string
  children: React.ReactNode
}

const ErrorContainer = styled(Container)(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  borderRadius: "8px",
  marginTop: "4rem",
  padding: "16px",
  boxShadow:
    "1px 2px 1px -1px rgba(0,0,0,0.2),0px 1px 1px 0px rgba(0,0,0,0.14),0px 1px 3px 0px rgba(0,0,0,0.12)",
}))
const Footer = styled.div({
  marginTop: "16px",
})

const ErrorPageTemplate: React.FC<ErrorPageTemplateProps> = ({
  children,
  title,
}) => {
  return (
    <ErrorContainer maxWidth="sm">
      <Typography variant="h3" component="h1">
        {title}
      </Typography>
      {children}
      <Footer>
        <ButtonLink variant="secondary" href={HOME}>
          Home
        </ButtonLink>
      </Footer>
    </ErrorContainer>
  )
}

export default ErrorPageTemplate
