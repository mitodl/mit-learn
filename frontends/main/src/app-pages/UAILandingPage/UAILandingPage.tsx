"use client"

import {
  Container,
  theme,
  styled,
  Typography,
  Card,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "ol-components"
import React from "react"
import Image from "next/image"
import { Button } from "@mitodl/smoot-design"
import { CarouselV2 } from "ol-components/CarouselV2"
import { RiAddLine, RiSubtractLine } from "@remixicon/react"

const PageContainer = styled(Container)({
  backgroundColor: theme.custom.colors.white,
  display: "flex",
  flexDirection: "column",
  margin: "0px",
  padding: "0 !important",
  maxWidth: "100% !important",
})

const GradientWrapper = styled.div({
  background: `linear-gradient(0deg, ${theme.custom.colors.lightGray1} 0%, ${theme.custom.colors.lightGray2} 100%)`,
})

const TopSection = styled.div({
  backgroundImage: "url('/images/backgrounds/globe.svg')",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right",
  backgroundSize: "contain",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  color: theme.custom.colors.darkGray2,
  width: "100%",
  minWidth: "1276px",
})

const HeaderContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "16px",
  padding: "80px 200px 64px 200px",
})

const HeroContainerOuter = styled.div({
  display: "flex",
  justifyContent: "center",
  width: "100%",
})

const HeroContainerInner = styled.div({
  display: "flex",
  position: "relative",
  padding: "16px 0",
  justifyContent: "center",
  alignItems: "stretch",
  alignSelf: "stretch",
  maxWidth: "1276px",
})

const HeroText = styled.div({
  display: "flex",
  flexDirection: "column",
  padding: "56px 56px 56px 0",
  gap: "40px",
  width: "50%",
})

const HeroImage = styled.div({
  display: "flex",
  position: "relative",
  objectFit: "contain",
  flexGrow: 1,
  borderRadius: "8px",
  width: "50%",
})

const InquireButton = styled(Button)({
  size: "large",
  variant: "primary",
  width: "200px",
  height: "48px",
  padding: "18px 24px",
})

const ProgramSection = styled.div({
  display: "flex",
  backgroundColor: theme.custom.colors.white,
  backgroundImage: "url('/images/backgrounds/uai_landing_background.svg')",
  backgroundRepeat: "no-repeat",
  color: theme.custom.colors.lightGray2,
  width: "100%",
  minWidth: "1276px",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
})

const ProgramContainer = styled.div({
  padding: "80px 200px",
  width: "100%",
})

const ProgramSectionTitle = styled.div({
  display: "flex",
  flexDirection: "column",
  alignSelf: "stretch",
  alignItems: "center",
  gap: "8px",
  marginBottom: "40px",
  color: theme.custom.colors.darkGray2,
})

const FoundationalProgramContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
})

const CardImage = styled(Image)({
  display: "block",
  width: "100%",
  height: "182px",
  backgroundColor: theme.custom.colors.lightGray1,
  objectFit: "cover",
})

const CardText = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  padding: "16px",
})

const BracketSeparator = styled.div({
  display: "flex",
  flexWrap: "wrap",
  alignContent: "end",
  justifyContent: "center",
  backgroundImage: "url('/images/uai_landing/uai-bracket.svg')",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
  backgroundSize: "contain",
  marginTop: "24px",
  paddingBottom: "32px",
  width: "100%",
  height: "157px",
})

const CarouselSection = styled.div({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  gap: "40px",
  width: "100%",
})

const CarouselContainer = styled.div({
  width: "1275px",
})

const StyledCarousel = styled(CarouselV2)({
  margin: "0 auto",
})

const ArrowButtonsContainer = styled.div({
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
})

const FAQSection = styled.div({
  display: "flex",
  backgroundColor: theme.custom.colors.lightGray1,
  color: theme.custom.colors.darkGray2,
  width: "100%",
  minWidth: "1276px",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
})

const FAQContainerOuter = styled.div({
  display: "flex",
  justifyContent: "center",
  padding: "80px 200px",
  width: "100%",
})

const FAQContainerInner = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "80px",
  margin: "0 auto",
  maxWidth: "1276px",
})

const FAQHeader = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: "16px",
})

const FAQWrapper = styled.div({
  display: "flex",
})

const FAQImageContainer = styled.div({
  display: "flex",
  paddingRight: "80px",
  width: "50%",
})

const FAQItemContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "32px",
  width: "50%",
})

const FAQAccordion = styled(Accordion)({
  backgroundColor: theme.custom.colors.white,
  borderTop: "none",
  borderRadius: "0",
  boxShadow: "none",
  "&:before": {
    display: "none",
  },
  "&:first-of-type": {
    borderTopLeftRadius: "0",
    borderTopRightRadius: "0",
  },
  "&:last-of-type": {
    borderBottomLeftRadius: "0",
    borderBottomRightRadius: "0",
  },
})

const FAQAccordionSummary = styled(AccordionSummary)({
  ".MuiAccordionSummary-content": {
    margin: "24px 0",
  },
})

const FAQInquireButtonContainer = styled.div({
  display: "flex",
  justifyContent: "center",
  marginTop: "40px",
})

const FAQItem: React.FC<{ question: string; answer: string }> = ({
  question,
  answer,
}) => {
  const [expanded, setExpanded] = React.useState(false)

  const handleChange = () => {
    setExpanded(!expanded)
  }

  const red = theme.custom.colors.red
  const darkGray2 = theme.custom.colors.darkGray2

  return (
    <FAQAccordion expanded={expanded} onChange={handleChange}>
      <FAQAccordionSummary
        expandIcon={
          expanded ? (
            <RiSubtractLine color={darkGray2} />
          ) : (
            <RiAddLine color={darkGray2} />
          )
        }
      >
        <Typography variant="h5" color={expanded ? red : darkGray2}>
          {question}
        </Typography>
      </FAQAccordionSummary>
      <AccordionDetails>
        <Typography variant="body1">{answer}</Typography>
      </AccordionDetails>
    </FAQAccordion>
  )
}

const UAILandingPage: React.FC = () => {
  const carouselItems = [
    {
      image: "/images/uai_landing/cards/ai-in-healthcare.jpg",
      title: "AI in Healthcare",
      subtitle: "Machine Learning in Healthcare and Biomedicine",
    },
    {
      image: "/images/uai_landing/cards/ai-in-climate.jpg",
      title: "AI in Climate",
      subtitle: "AI in Climate Change and Environmental Science",
    },
    {
      image: "/images/uai_landing/cards/ai-in-finance.jpg",
      title: "AI in Finance",
      subtitle: "AI Applications in Finance and Fintech",
    },
    {
      image: "/images/uai_landing/cards/ai-in-agriculture.jpg",
      title: "AI in Agriculture",
      subtitle: "AI in Agriculture and Food Security",
    },
    {
      image: "/images/uai_landing/cards/ai-in-transportation.jpg",
      title: "AI in Transportation",
      subtitle: "Machine Learning in Transportation and Logistics",
    },
    {
      image: "/images/uai_landing/cards/ai-in-education.jpg",
      title: "AI in Education",
      subtitle: "AI in Education and E-learning",
    },
    {
      image: "/images/uai_landing/cards/ai-in-gaming.jpg",
      title: "AI in Gaming",
      subtitle: "AI in Entertainment and Gaming",
    },
    {
      image: "/images/uai_landing/cards/ai-in-urban-planning.jpg",
      title: "AI in Urban Planning",
      subtitle: "Data Science for Urban Planning and Smart Cities",
    },
    {
      image: "/images/uai_landing/cards/ai-in-manufacturing.jpg",
      title: "AI in Manufacturing",
      subtitle: "AI in Manufacturing and Industry 4.0",
    },
    {
      image: "/images/uai_landing/cards/ai-in-astronomy.jpg",
      title: "AI in Astronomy",
      subtitle: "Machine Learning in Astronomy and Space Exploration",
    },
  ]

  const faqItems = [
    {
      question: "How are the lectures by MIT faculty structured?",
      answer: "This is a placeholder answer for the question provided.",
    },
    {
      question: "How do guided exercises support learning?",
      answer: "This is a placeholder answer for the question provided.",
    },
    {
      question:
        "What is the AI-powered AskTIM feature and how does it support learners?",
      answer: "This is a placeholder answer for the question provided.",
    },
    {
      question: "How is learning assessed throughout the modules?",
      answer: "This is a placeholder answer for the question provided.",
    },
    {
      question:
        "What kind of support is available for administrators and instructors?",
      answer: "This is a placeholder answer for the question provided.",
    },
  ]

  const [arrowsContainerRef, setArrowsContainerRef] =
    React.useState<HTMLDivElement | null>(null)
  const arrows = (
    <ArrowButtonsContainer
      role="group"
      aria-label="Slide navigation"
      ref={setArrowsContainerRef}
    />
  )

  return (
    <PageContainer>
      <GradientWrapper>
        <TopSection>
          <HeaderContainer>
            <Typography variant="h1" justifyContent="center">
              <Typography variant="h1" color={theme.custom.colors.lightRed}>
                Universal
              </Typography>{" "}
              AI Education from MIT
            </Typography>
            <Typography variant="h5">
              Preparing learners for a future powered by AI.
            </Typography>
            <HeroContainerOuter>
              <HeroContainerInner>
                <HeroText>
                  <Typography variant="h2">
                    Learning content, for everyone
                  </Typography>
                  <Typography variant="body1">
                    Universal AI education from MIT is a dynamic online learning
                    experience that spans the theoretical foundations and
                    real-world applications of artificial intelligence,
                    preparing learners for employment in our rapidly evolving
                    job market. MIT faculty and experts provide universal
                    education on how to understand, use, apply, and interpret AI
                    in a way that is approachable to learners without a strong
                    technical background.
                  </Typography>
                  <InquireButton>Inquire Now</InquireButton>
                </HeroText>
                <HeroImage>
                  <Image
                    alt=""
                    src="/images/uai_landing/uai-landing-hero.jpg"
                    layout="fill"
                    objectFit="contain"
                  />
                </HeroImage>
              </HeroContainerInner>
            </HeroContainerOuter>
          </HeaderContainer>
        </TopSection>
      </GradientWrapper>
      <ProgramSection>
        <ProgramContainer>
          <ProgramSectionTitle>
            <Typography variant="h2">How does it work?</Typography>
            <Typography variant="h5">
              Start with the building blocks of Artificial Intelligence
            </Typography>
          </ProgramSectionTitle>
          <FoundationalProgramContainer>
            <Card size="medium">
              <Card.Content>
                <CardImage
                  src="/images/uai_landing/cards/foundational-ai-modules.jpg"
                  alt=""
                  height={170}
                  width={298}
                />
                <CardText>
                  <Typography
                    variant="subtitle3"
                    color={theme.custom.colors.silverGrayDark}
                  >
                    Program
                  </Typography>
                  <Typography
                    variant="subtitle1"
                    color={theme.custom.colors.darkGray2}
                  >
                    Foundational AI Modules
                  </Typography>
                </CardText>
              </Card.Content>
            </Card>
          </FoundationalProgramContainer>
          <BracketSeparator>
            <Typography variant="h5" color={theme.custom.colors.darkGray2}>
              Then apply this foundational knowledge to different fields of
              study
            </Typography>
          </BracketSeparator>
          <CarouselSection>
            <CarouselContainer>
              <StyledCarousel arrowsContainer={arrowsContainerRef}>
                {carouselItems.map((item, index) => (
                  <Card key={index} size="medium">
                    <Card.Content>
                      <CardImage
                        src={item.image}
                        alt=""
                        height={170}
                        width={298}
                      />
                      <CardText>
                        <Typography
                          variant="subtitle3"
                          color={theme.custom.colors.silverGrayDark}
                        >
                          {item.title}
                        </Typography>
                        <Typography
                          variant="subtitle1"
                          color={theme.custom.colors.darkGray2}
                        >
                          {item.subtitle}
                        </Typography>
                      </CardText>
                    </Card.Content>
                  </Card>
                ))}
              </StyledCarousel>
            </CarouselContainer>
            {arrows}
            <InquireButton>Inquire Now</InquireButton>
          </CarouselSection>
        </ProgramContainer>
      </ProgramSection>
      <FAQSection>
        <FAQContainerOuter>
          <FAQContainerInner>
            <FAQHeader>
              <Typography variant="h2">FAQ</Typography>
              <Typography variant="subtitle1">
                Created by a team of 30+ faculty and experts from across MIT,
                and drawing on their existing courses and research, Universal AI
                offers an integrated learning experience focused on real-world
                application.
              </Typography>
            </FAQHeader>
            <FAQWrapper>
              <FAQImageContainer>
                <Image
                  alt=""
                  src="/images/uai_landing/uai-faq.png"
                  width={568}
                  height={528}
                />
              </FAQImageContainer>
              <FAQItemContainer>
                {faqItems.map((item, index) => (
                  <FAQItem
                    key={index}
                    question={item.question}
                    answer={item.answer}
                  />
                ))}
              </FAQItemContainer>
            </FAQWrapper>
            <FAQInquireButtonContainer>
              <InquireButton>Inquire Now</InquireButton>
            </FAQInquireButtonContainer>
          </FAQContainerInner>
        </FAQContainerOuter>
      </FAQSection>
    </PageContainer>
  )
}

export { UAILandingPage }
