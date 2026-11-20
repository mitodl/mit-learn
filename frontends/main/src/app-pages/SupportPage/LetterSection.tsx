import React from "react"
import Image from "next/image"
import { styled } from "ol-components"
import { Section, SectionInner, SectionTitle } from "./SectionLayout"

const Band = styled(Section)(({ theme }) => ({
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
}))

const Header = styled.div(({ theme }) => ({
  paddingBottom: "24px",
  borderBottom: `2px solid ${theme.custom.colors.darkGray2}`,
}))

const Body = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  paddingTop: "32px",
})

const Salutation = styled.p(({ theme }) => ({
  ...theme.typography.h5,
  fontSize: theme.typography.pxToRem(20),
  lineHeight: theme.typography.pxToRem(28),
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

/**
 * The design splits the letter across two columns mid-sentence; CSS columns
 * reproduce that and keep reflowing correctly if the copy changes.
 */
const Columns = styled.div(({ theme }) => ({
  ...theme.typography.body1Loose,
  color: theme.custom.colors.darkGray2,
  columnCount: 2,
  columnGap: "64px",
  p: {
    margin: "0 0 26px",
  },
  [theme.breakpoints.down("md")]: {
    columnCount: 1,
  },
}))

const Signature = styled.div(({ theme }) => ({
  breakInside: "avoid",
  display: "flex",
  gap: "16px",
  padding: "16px 8px 8px",
  borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
}))

const Portrait = styled(Image)(({ theme }) => ({
  flexShrink: 0,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
}))

const SignOff = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "1px",
  color: theme.custom.colors.darkGray2,
}))

/** A serif italic, as in the design, to read as a handwritten sign-off. */
const Gratitude = styled.span({
  fontFamily: "Georgia, serif",
  fontStyle: "italic",
  fontSize: "16px",
  lineHeight: "23px",
})

const Name = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
  fontWeight: theme.typography.fontWeightBold,
  fontSize: theme.typography.pxToRem(17),
  lineHeight: theme.typography.pxToRem(25),
  paddingTop: "3px",
}))

const Role = styled.span(({ theme }) => ({
  ...theme.typography.body3,
  lineHeight: theme.typography.pxToRem(17),
  color: theme.custom.colors.silverGrayDark,
}))

const LetterSection: React.FC = () => (
  <Band>
    <SectionInner>
      <Header>
        <SectionTitle>
          A little support can open a world of possibility.
        </SectionTitle>
      </Header>
      <Body>
        <Salutation>Dear friends of open learning,</Salutation>
        <Columns>
          <p>
            At MIT Open Learning, we believe that knowledge should be a public
            good. By keeping our educational resources free and openly
            available, we help learners everywhere explore new ideas, build
            skills, and create opportunity in their own communities.
          </p>
          <p>
            Your support makes this possible. Whether through a gift, a shared
            story, or by helping others discover our resources, you play a vital
            role in extending the reach and impact of MIT’s teaching and
            learning beyond our campus.
          </p>
          <p>
            I've seen firsthand how open learning can change lives — from
            students gaining new skills, to educators finding fresh ideas, to
            lifelong learners pursuing their curiosity. With your support, we
            can continue to make high-quality MIT education available to more
            people around the world.
          </p>
          <p>Thank you for being part of this important work.</p>
          <Signature>
            <Portrait
              src="/images/support/yvonne-ng.jpg"
              alt=""
              width={108}
              height={108}
            />
            <SignOff>
              <Gratitude>With gratitude,</Gratitude>
              <Name>Yvonne Ng</Name>
              <Role>Annual Giving and Donor Relations Officer</Role>
              <Role>MIT Open Learning</Role>
            </SignOff>
          </Signature>
        </Columns>
      </Body>
    </SectionInner>
  </Band>
)

export default LetterSection
