import React from "react"
import Image from "next/image"
import graduateLogo from "@/public/images/dashboard/graduate.png"
import { Stack, Typography, styled, theme } from "ol-components"
import { useQuery } from "@tanstack/react-query"
import { DashboardCardRoot } from "./DashboardCard"
import { mitxUserQueries } from "api/mitxonline-hooks/user"
import { contractQueries } from "api/mitxonline-hooks/contracts"
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
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    backgroundColor: "rgba(243, 244, 248, 0.60);", // TODO: use theme color
    marginTop: "16px",
    padding: "0",
    gap: "8px",
  },
}))

const CardRootStyled = styled(DashboardCardRoot)({
  borderRadius: "8px",
  boxShadow: "0px 1px 6px 0px rgba(3, 21, 45, 0.05)",
})

const ContractCard = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "16px",
})

const ContractCardInner = styled.div({
  width: "100%",
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

const ContractCardContent = styled(Stack)({
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
})

interface OrganizationContractsProps {
  org: OrganizationPage
}

const OrganizationContracts: React.FC<OrganizationContractsProps> = ({
  org,
}) => {
  const { data: contracts, isLoading } = useQuery(
    contractQueries.contractsList(),
  )
  const orgContracts = contracts?.filter(
    (contract) => contract.organization === org.id,
  )
  const cardContent = (contractName: string, orgSlug: string) => (
    <ContractCardContent direction="row">
      <Typography variant="subtitle2">{contractName}</Typography>
      <ButtonLink
        size="small"
        href={organizationView(orgSlug.replace("org-", ""))}
      >
        Continue
      </ButtonLink>
    </ContractCardContent>
  )
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
      {contracts?.length && !isLoading
        ? orgContracts?.map((contract) => (
            <ContractCardInner key={contract.id}>
              <CardRootStyled theme={theme} screenSize="mobile">
                {cardContent(contract.name, org.slug)}
              </CardRootStyled>
              <CardRootStyled theme={theme} screenSize="desktop">
                {cardContent(contract.name, org.slug)}
              </CardRootStyled>
            </ContractCardInner>
          ))
        : null}
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
