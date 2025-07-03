"use client"

import {
  Breadcrumbs,
  Container,
  Typography,
  TypographyProps,
  styled,
} from "ol-components"
import * as urls from "@/common/urls"
import React from "react"

const PageContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  alignSelf: "stretch",
  padding: "40px 84px 80px 84px",
  [theme.breakpoints.down("md")]: {
    padding: "40px 24px 80px 24px",
  },
}))

const BannerContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  paddingBottom: "16px",
})

const BannerContainerInner = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  alignSelf: "stretch",
  justifyContent: "center",
})

const Header = styled(Typography)<Pick<TypographyProps, "component">>(
  ({ theme }) => ({
    alignSelf: "stretch",
    color: theme.custom.colors.black,
  }),
)

const BodyContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  alignSelf: "stretch",
  gap: "20px",
})

const BodyText = styled(Typography)<Pick<TypographyProps, "component">>(
  ({ theme }) => ({
    alignSelf: "stretch",
    color: theme.custom.colors.black,
  }),
)

const UnorderedList = styled.ul(({ theme }) => ({
  alignSelf: "stretch",
  ...theme.typography.body1,
  marginTop: "10px",
}))

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME

const HonorCodePage: React.FC = () => {
  return (
    <Container>
      <PageContainer>
        <BannerContainer>
          <BannerContainerInner>
            <Breadcrumbs
              variant="light"
              ancestors={[{ href: urls.HOME, label: "Home" }]}
              current="Honor Code"
            />
            <Header component="h1" variant="h2">
              Honor Code
            </Header>
          </BannerContainerInner>
        </BannerContainer>
        <BodyContainer>
          <BodyText component="h2" variant="h4">
            COLLABORATION POLICY
          </BodyText>
          <BodyText variant="body1">
            In order to participate in {SITE_NAME} offering, including accessing
            any course material or other electronic services, you must agree to
            the Honor Code below and any additional terms specific to the
            offering you have selected. This Honor Code, and any additional
            terms, will be posted on each module/ course website.
          </BodyText>
          <BodyText component="h2" variant="h4">
            HONOR CODE PLEDGE
          </BodyText>
          <BodyText variant="body1">
            By enrolling in a {SITE_NAME} course or program, I agree that I
            will:
          </BodyText>
          <UnorderedList>
            <li>
              Complete all tests and assignments on my own, unless collaboration
              on an assignment is explicitly permitted.
            </li>
            <li>
              Maintain only one user account and not let anyone else use my
              username and/or password.
            </li>
            <li>
              Not engage in any activity that would dishonestly improve my
              results, or improve or hurt the results of others.
            </li>
            <li>
              Not post online or share answers to problems that are being used
              to assess learner performance.
            </li>
          </UnorderedList>
          <BodyText component="h2" variant="h4">
            VIOLATIONS
          </BodyText>
          <BodyText variant="body1">
            If you are found in violation of the Terms of Service or Honor Code,
            you may be subject to one or more of the following actions:
          </BodyText>
          <UnorderedList>
            <li>Receiving a zero or no credit for an assignment;</li>
            <li>
              Having any certificate earned in the course or program withheld or
              revoked;
            </li>
            <li>Being unenrolled from an offering; or</li>
            <li>Termination of your use of the {SITE_NAME} Site.</li>
            <li>
              Additional actions may be taken at the sole discretion of MIT.
            </li>
            <li>
              No refunds will be issued in the case of any corrective action for
              such violations.
            </li>
          </UnorderedList>

          <BodyText variant="body1">
            Honor Code violations will be determined at the sole discretion of
            MIT. You will be notified if a determination has been made that you
            have violated this Honor Code and you will be informed of the
            corresponding action to be taken as a result of the violation.
          </BodyText>
          <BodyText component="h2" variant="h4">
            CHANGING THE HONOR CODE
          </BodyText>
          <BodyText variant="body1">
            Please note that we review and may make changes to this Honor Code
            from time to time. Any changes to this Honor Code will be effective
            immediately upon posting on this page, with an updated effective
            date. By accessing the {SITE_NAME} Site after any changes have been
            made, you signify your agreement on a prospective basis to the
            modified Honor Code and any changes contained therein. Be sure to
            return to this page periodically to ensure familiarity with the most
            current version of this Honor Code.
          </BodyText>
          <BodyText variant="body1">
            This Honor Code was last updated on June 9, 2025.
          </BodyText>
        </BodyContainer>
      </PageContainer>
    </Container>
  )
}

export default HonorCodePage
