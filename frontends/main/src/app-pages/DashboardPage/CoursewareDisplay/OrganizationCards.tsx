import React from "react"
import Image from "next/image"
import graduateLogo from "@/public/images/dashboard/graduate.png"
import { Stack, Typography, styled, theme, Link } from "ol-components"
import { useQuery } from "@tanstack/react-query"
import { DashboardCardRoot } from "./DashboardCard"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { ButtonLink } from "@mitodl/smoot-design"
import { organizationView } from "@/common/urls"
import { OrganizationPage } from "@mitodl/mitxonline-api-axios/v2"

const Wrapper = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "40px",
  marginTop: "32px",
  padding: "24px 32px 32px 32px",
  backgroundColor: theme.custom.colors.white,
  borderBottom: `1px solid ${theme.custom.colors.red}`,
  boxShadow: "0px 4px 8px 0px rgba(19, 20, 21, 0.08)",
  borderRadius: "8px",
  [theme.breakpoints.down("md")]: {
    backgroundColor: "transparent",
    padding: 0,
    border: "none",
    borderRadius: "0",
    boxShadow: "none",
    gap: "24px",
  },
}))

const ContractCard = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "16px",
  [theme.breakpoints.down("md")]: {
    boxShadow: "0px 4px 8px 0px rgba(19, 20, 21, 0.08)",
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    borderBottom: `1px solid ${theme.custom.colors.red}`,
    borderRadius: "8px !important",
  },
})

const CardRootStyled = styled(DashboardCardRoot)({
  display: "flex",
  flexDirection: "column",
  padding: 0,
  gap: "0px !important",
  width: "100%",
  borderRadius: "8px",
  boxShadow: "0px 1px 6px 0px rgba(3, 21, 45, 0.05)",
  [theme.breakpoints.down("md")]: {
    borderRadius: "8px !important",
  },
})

const TitleLink = styled(Link)({
  width: "100%",
})

const CardContent = styled(Stack)({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px",
  width: "100%",
  gap: "16px",
  "&:not(:last-child)": {
    borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  },
})

const ImageContainer = styled.div({
  position: "relative",
  width: "32px",
  height: "32px",
  flexShrink: 0,
})

const Title = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  alignSelf: "stretch",
  [theme.breakpoints.down("md")]: {
    padding: "8px",
  },
}))

interface OrganizationContractsProps {
  org: OrganizationPage
}

const OrganizationContracts: React.FC<OrganizationContractsProps> = ({
  org,
}) => {
  const contractContent =
    org.contracts?.map((contract) => {
      const href = organizationView(org.slug.replace("org-", ""))
      return (
        <CardContent key={contract.id} direction="row">
          <TitleLink size="medium" color="black" href={href}>
            {contract.name}
          </TitleLink>
          <ButtonLink size="small" href={href}>
            Continue
          </ButtonLink>
        </CardContent>
      )
    }) ?? null
  return (
    <ContractCard>
      <Title key={org.id}>
        <ImageContainer>
          <Image
            src={org.logo ?? graduateLogo}
            alt=""
            fill
            style={{ objectFit: "contain" }}
          />
        </ImageContainer>
        <Typography variant="body2">
          {"As a member of "}
          <Typography variant="subtitle2" component="span">
            {org.name}
          </Typography>
          {" you have access to:"}
        </Typography>
      </Title>
      <CardRootStyled screenSize="mobile">{contractContent}</CardRootStyled>
      <CardRootStyled screenSize="desktop">{contractContent}</CardRootStyled>
    </ContractCard>
  )
}

const OrganizationCards = () => {
  const mitxOnlineUser = useQuery(mitxUserQueries.me())

  return (
    <>
      {mitxOnlineUser.data &&
      mitxOnlineUser.data.b2b_organizations.length > 0 ? (
        <Wrapper>
          {mitxOnlineUser.data.b2b_organizations.map((org) => (
            <OrganizationContracts key={org.id} org={org} />
          ))}
        </Wrapper>
      ) : null}
    </>
  )
}

export { OrganizationCards }
