"use client"

import React from "react"
// Not currently linked to. See https://github.com/mitodl/hq/issues/4639
import {
  Breadcrumbs,
  Container,
  Typography,
  TypographyProps,
  styled,
  Link,
} from "ol-components"
import * as urls from "@/common/urls"

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
  gap: "10px",
})

const BodyText = styled(Typography)(({ theme }) => ({
  alignSelf: "stretch",
  color: theme.custom.colors.black,
}))

const OrderedList = styled.ol(({ theme }) => ({
  ...theme.typography.body1,
  li: {
    marginTop: "10px",
  },
}))

const LetteredOrderedList = styled.ol(({ theme }) => ({
  ...theme.typography.body1,
  listStyleType: "upper-alpha",
}))

const UnorderedList = styled.ul(({ theme }) => ({
  ...theme.typography.body1,
}))

const TermsPage: React.FC = () => {
  return (
    <Container>
      <PageContainer>
        <BannerContainer>
          <BannerContainerInner>
            <Breadcrumbs
              variant="light"
              ancestors={[{ href: urls.HOME, label: "Home" }]}
              current="Terms of Service"
            />
            <Header component="h1" variant="h3">
              Terms of Service
            </Header>
          </BannerContainerInner>
        </BannerContainer>
        <BodyContainer>
          <BodyText variant="body1">
            Welcome to MIT Learn (the “Site”). By accessing this Site, you agree
            to be bound by the following terms and conditions (the “Terms”),
            which MIT may revise at any time. You are encouraged to visit this
            page periodically to review current terms and conditions, as your
            continued use of this Site signifies your agreement to these term
            and conditions.
          </BodyText>
          <OrderedList>
            <li>
              By using this Site, you confirm that you are at least 13 years old
              or have the legal capacity to enter into a binding agreement in
              your jurisdiction. If you do not agree with these Terms, including
              the Terms of Service and Privacy Policy, you must not access or
              use the Site.
            </li>
            <li>
              MIT Learn respects your privacy. Please review{" "}
              <Link href={urls.PRIVACY} color="red" size="large">
                https://learn.mit.edu/privacy
              </Link>{" "}
              for more information on how this Site collects, stores, and uses
              your personal information.
            </li>
            <li>
              Additional Terms of Service: Certain features or services offered
              on or through the Site may be subject to additional terms and
              conditions. Use of those services of offerings is governed by
              their respective Terms of Service, which are made available at the
              point of use and are incorporated into these Terms by reference.
              <LetteredOrderedList>
                <li>
                  Terms of Service
                  <UnorderedList>
                    <li>
                      MITx Online:{" "}
                      <Link
                        href="https://mitxonline.mit.edu/terms-of-service/"
                        color="red"
                        size="large"
                      >
                        https://mitxonline.mit.edu/terms-of-service/
                      </Link>
                    </li>
                  </UnorderedList>
                </li>
                <li>
                  Privacy Policy
                  <UnorderedList>
                    <li>
                      MITx Online:{" "}
                      <Link
                        href="https://mitxonline.mit.edu/privacy-policy"
                        color="red"
                        size="large"
                      >
                        https://mitxonline.mit.edu/privacy-policy/
                      </Link>
                    </li>
                  </UnorderedList>
                </li>
                <li>
                  Honor Code
                  <UnorderedList>
                    <li>
                      MITx Online:{" "}
                      <Link
                        href="https://mitxonline.mit.edu/honor-code/"
                        color="red"
                        size="large"
                      >
                        https://mitxonline.mit.edu/honor-code/
                      </Link>
                    </li>
                  </UnorderedList>
                </li>
              </LetteredOrderedList>
            </li>
            <li>
              MIT respects the intellectual property rights of others. If you
              believe another user is infringing your copyright, please provide
              written notice to MIT by emailing{" "}
              <Link
                href="mailto:dmca-agent@mit.edu."
                size="large"
                color="black"
              >
                dmca-agent@mit.edu.
              </Link>{" "}
              {""}
              You agree that if a third party claims that any material you have
              contributed to the Site is unlawful, you will bear the burden of
              establishing that the material complies with all applicable laws.
            </li>
            <li>
              All content, design, text, graphics, logos, images, software, and
              other materials on the Site are the property of MIT and/or its
              licensors and are protected by intellectual property laws. You may
              not copy, distribute, modify, or create derivative works without
              our express written permission.
            </li>
            <li>
              "MIT", "Massachusetts Institute of Technology", and its logos and
              seal are trademarks of the Massachusetts Institute of Technology.
              Except for purposes of attribution, you may not use MIT’s names or
              logos, or any variations thereof, without prior written consent of
              MIT. You may not use the MIT name in any of its forms nor MIT
              seals or logos for promotional purposes, or in any way that
              deliberately or inadvertently claims, suggests, or in MIT’s sole
              judgment gives the appearance or impression of a relationship with
              or endorsement by MIT.
            </li>
            <li>
              NEITHER MIT, ITS AFFILIATES, TRUSTEES, DIRECTORS, OFFICERS,
              EMPLOYEES AND AGENTS SHALL HAVE ANY LIABILITY FOR ANY DAMAGES,
              INCLUDING WITHOUT LIMITATION, ANY DIRECT, INDIRECT, INCIDENTAL,
              COMPENSATORY, PUNITIVE, SPECIAL OR CONSEQUENTIAL DAMAGES (EVEN IF
              MIT HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES) ARISING
              FROM OR RELATED TO THE USE OF THE SITE, CONTENT, AND/OR
              COMPILATION.
            </li>
            <li>
              You agree to defend, hold harmless and indemnify MIT, and its
              subsidiaries, affiliates, officers, agents, and employees from and
              against any third-party claims, actions or demands arising out of,
              resulting from or in any way related to your use of the Site,
              including any liability or expense arising from any and all
              claims, losses, damages (actual and consequential), suits,
              judgments, litigation costs and attorneys’ fees, of every kind and
              nature. In such a case, MIT will provide you with written notice
              of such claim, suit or action.
            </li>
            <li>
              These terms and conditions constitute the entire agreement between
              you and MIT with respect to your use of the Site, superseding any
              prior agreements between you and MIT regarding your use of the
              Site. The failure of MIT to exercise or enforce any right or
              provision of the terms and conditions shall not constitute a
              waiver of such right or provision. If any provision of the terms
              and conditions is found by a court of competent jurisdiction to be
              invalid, the parties nevertheless agree that the court should
              endeavor to give effect to the parties’ intentions as reflected in
              the provision, and the other provisions of the terms and
              conditions remain in full force and effect.
            </li>
            <li>
              You agree that any dispute arising out of or relating to these
              terms and conditions or any content posted to the Site will be
              governed by the laws of the Commonwealth of Massachusetts,
              excluding its conflicts of law provisions. You further consent to
              the personal jurisdiction of and exclusive venue in the federal
              and state courts located in and serving Boston, Massachusetts as
              the legal forum for any such dispute.
            </li>
          </OrderedList>
        </BodyContainer>
      </PageContainer>
    </Container>
  )
}

export default TermsPage
