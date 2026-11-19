import React from "react"
import Image from "next/image"
import { styled } from "ol-components"
import { ButtonLink } from "@mitodl/smoot-design"
import {
  RiArrowRightLine,
  RiMacbookLine,
  RiStackLine,
  RiTeamLine,
} from "@remixicon/react"
import { Section, SectionInner, SectionTitle } from "./SectionLayout"
import { ONE_PAGER_URLS, OPEN_LEARNING_GIVE_URL } from "./links"

const Inner = styled(SectionInner)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "64px",
  [theme.breakpoints.down("sm")]: {
    gap: "24px",
  },
}))

const Intro = styled.div(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  gap: "45px",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    gap: "24px",
  },
}))

const Lead = styled.div(({ theme }) => ({
  flex: "551 1 0",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: "16px",
  paddingRight: "32px",
  borderRight: `1px solid ${theme.custom.colors.silverGrayLight}`,
  [theme.breakpoints.down("md")]: {
    paddingRight: 0,
    borderRight: "none",
  },
  [theme.breakpoints.down("sm")]: {
    justifyContent: "flex-start",
    gap: "12px",
  },
}))

const Tagline = styled.p(({ theme }) => ({
  ...theme.typography.h4,
  color: theme.custom.colors.red,
  margin: 0,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.subtitle1,
    lineHeight: 1.5,
  },
}))

const Mission = styled.div(({ theme }) => ({
  ...theme.typography.body1,
  flex: "680 1 0",
  lineHeight: theme.typography.pxToRem(24),
  color: theme.custom.colors.darkGray2,
  p: {
    margin: "0 0 24px",
  },
  "p:last-child": {
    marginBottom: 0,
  },
  strong: {
    fontWeight: theme.typography.fontWeightBold,
  },
}))

const Cards = styled.ul(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "32px",
  listStyle: "none",
  margin: 0,
  padding: 0,
  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: "16px",
  },
  [theme.breakpoints.down("sm")]: {
    gap: "24px",
  },
}))

const Card = styled.li(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: "32px",
  padding: "32px",
  backgroundColor: theme.custom.colors.white,
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "8px",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    gap: "16px",
    padding: "16px",
  },
}))

/** 40px icon, 4px inset, 8px tile padding: a 64px light-gray tile. */
const IconTile = styled.span(({ theme }) => ({
  display: "flex",
  flexShrink: 0,
  padding: "12px",
  borderRadius: "8px",
  backgroundColor: theme.custom.colors.lightGray1,
  color: theme.custom.colors.silverGrayDark,
  "svg, img": {
    display: "block",
    width: "40px",
    height: "40px",
  },
}))

const CardText = styled.div({
  flex: 1,
  minWidth: 0,
  alignSelf: "stretch",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const CardTitle = styled.h3(({ theme }) => ({
  ...theme.typography.h4,
  color: theme.custom.colors.darkGray2,
  margin: 0,
  [theme.breakpoints.down("sm")]: {
    ...theme.typography.h5,
  },
}))

/** Full width on phones, 32px below the cards. */
const Action = styled.div(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    marginTop: "8px",
    "& > a": {
      width: "100%",
    },
  },
}))

/** Grows so "Learn more" lines up across the cards in a row. */
const CardBody = styled.p(({ theme }) => ({
  ...theme.typography.body2Loose,
  flex: 1,
  color: theme.custom.colors.darkGray2,
  margin: 0,
}))

const LearnMore = styled.a(({ theme }) => ({
  ...theme.typography.subtitle2,
  display: "inline-flex",
  alignItems: "center",
  alignSelf: "flex-start",
  gap: "8px",
  color: theme.custom.colors.mitRed,
  svg: {
    width: "18px",
    height: "18px",
  },
  "&:hover": {
    textDecoration: "underline",
  },
}))

const INITIATIVES = [
  {
    title: "Reaching one billion learners",
    body: "Help us create innovative digital learning experiences that break down barriers to education and expand MIT’s global impact.",
    icon: <RiMacbookLine />,
    href: ONE_PAGER_URLS.oneBillionLearners,
  },
  {
    title: "Breaking down barriers to access",
    body: "Help support the values of openness, access, and lifelong learning through MIT OpenCourseWare.",
    icon: <RiStackLine />,
    href: ONE_PAGER_URLS.barriersToAccess,
  },
  {
    title: "Advancing AI and climate education",
    body: "Help us make lifelong learning more accessible and personalized by leveraging AI technology and expanding climate and ethics education.",
    icon: (
      <Image src="/images/support/ai-icon.svg" alt="" width={40} height={40} />
    ),
    href: ONE_PAGER_URLS.aiAndClimate,
  },
  {
    title: "Strengthening equity & collaborations",
    body: "Help us expand access to unique learning experiences that focus on the foundations and applications of AI, and create pathways to opportunity for underserved learners.",
    icon: <RiTeamLine />,
    href: ONE_PAGER_URLS.equityAndCollaborations,
  },
]

const InitiativesSection: React.FC = () => (
  <Section shade="gray">
    <Inner>
      <Intro>
        <Lead>
          <SectionTitle>
            Learn more about how you can support MIT Open Learning’s
            transformative initiatives
          </SectionTitle>
          <Tagline>Together, we open learning.</Tagline>
        </Lead>
        <Mission>
          <p>
            <strong>MIT Open Learning is expanding access</strong> to
            transformative education worldwide, using innovation and technology
            to help learners everywhere reach their potential.
          </p>
          <p>
            <strong>Our vision is bold:</strong> empower one billion learners
            through AI-enabled personalized education, advance knowledge in
            interdisciplinary areas like climate and energy, and remove barriers
            to opportunity.
          </p>
          <p>
            <strong>With your support</strong>, we can broaden access, spark
            innovation, and prepare learners around the world to meet the
            challenges of the future.
          </p>
        </Mission>
      </Intro>
      <Cards>
        {INITIATIVES.map(({ title, body, icon, href }) => (
          <Card key={title}>
            <IconTile aria-hidden>{icon}</IconTile>
            <CardText>
              <CardTitle>{title}</CardTitle>
              <CardBody>{body}</CardBody>
              <LearnMore
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Learn more about ${title}`}
              >
                Learn more
                <RiArrowRightLine aria-hidden />
              </LearnMore>
            </CardText>
          </Card>
        ))}
      </Cards>
      <Action>
        <ButtonLink
          variant="primary"
          size="large"
          href={OPEN_LEARNING_GIVE_URL}
          endIcon={<RiArrowRightLine aria-hidden />}
        >
          Make a donation
        </ButtonLink>
      </Action>
    </Inner>
  </Section>
)

export default InitiativesSection
