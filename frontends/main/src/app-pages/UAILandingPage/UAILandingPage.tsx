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
  MenuItem,
  SelectField,
  Skeleton,
  Stack,
} from "ol-components"
import React, { useEffect, useRef } from "react"
import Image from "next/image"
import { Button, ButtonLink, Input } from "@mitodl/smoot-design"
import { CarouselV2 } from "ol-components/CarouselV2"
import { RiAddLine, RiSubtractLine } from "@remixicon/react"

const DesktopOnly = styled.div(({ theme }) => ({
  [theme.breakpoints.up("sm")]: {
    display: "flex",
  },
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}))

const MobileOnly = styled.div(({ theme }) => ({
  [theme.breakpoints.up("sm")]: {
    display: "none",
  },
  [theme.breakpoints.down("sm")]: {
    display: "flex",
  },
}))

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
  [theme.breakpoints.down("md")]: {
    backgroundImage: "none",
    minWidth: "0",
  },
})

const HeaderContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "16px",
  padding: "80px 200px 64px 200px",
  [theme.breakpoints.down("md")]: {
    gap: "24px",
    padding: "32px 16px",
  },
})

const TopHeader = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: "16px",
})

const HeroContainerOuter = styled.div({
  display: "flex",
  justifyContent: "center",
  width: "100%",
})

const HeroContainerInner = styled.div({
  display: "flex",
  position: "relative",
  padding: "64px 0",
  justifyContent: "center",
  alignItems: "stretch",
  alignSelf: "stretch",
  maxWidth: "1276px",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column-reverse",
    padding: "0",
  },
})

const TopHeaderText = styled(Typography)({
  ...theme.typography.h1,
  [theme.breakpoints.down("md")]: {
    textAlign: "center",
    ...theme.typography.h3,
  },
})

const HeaderText = styled(Typography)({
  ...theme.typography.h2,
  [theme.breakpoints.down("md")]: {
    textAlign: "center",
    ...theme.typography.h4,
  },
})

const SubheaderText = styled(Typography)({
  ...theme.typography.h5,
  [theme.breakpoints.down("md")]: {
    textAlign: "center",
    ...theme.typography.subtitle1,
  },
})

const HeroText = styled.div({
  display: "flex",
  flexDirection: "column",
  padding: "0 56px 56px 0",
  gap: "16px",
  width: "50%",
  [theme.breakpoints.down("md")]: {
    padding: "0",
    paddingTop: "24px",
    gap: "24px",
    width: "100%",
  },
})

const HeroTextCard = styled.div({
  display: "flex",
  alignItems: "center",
  alignSelf: "stretch",
  borderRadius: "8px",
  backgroundColor: theme.custom.colors.white,
  padding: "16px 24px",
})

const HeroHeaderText = styled(Typography)({
  ...theme.typography.h3,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.h4,
    textAlign: "center",
  },
})

const HeroSubheaderText = styled(Typography)({
  ...theme.typography.body1,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.body2,
  },
})

const HeroImage = styled.div({
  display: "flex",
  position: "relative",
  flexGrow: 1,
  borderRadius: "8px",
  overflow: "hidden",
  width: "50%",
  img: {
    objectFit: "cover",
  },
  [theme.breakpoints.down("md")]: {
    width: "100%",
    height: "300px",
  },
})

const InquireButton = styled(ButtonLink)({
  size: "large",
  variant: "primary",
  width: "200px",
  height: "48px",
  padding: "18px 24px",
  [theme.breakpoints.down("md")]: {
    width: "100%",
  },
})

const ProgramSection = styled.div({
  display: "flex",
  justifyContent: "center",
  backgroundColor: theme.custom.colors.white,
  backgroundImage: "url('/images/backgrounds/uai_landing_background.svg')",
  backgroundRepeat: "no-repeat",
  color: theme.custom.colors.lightGray2,
  padding: "80px 200px",
  width: "100%",
  minWidth: "1276px",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  [theme.breakpoints.down("md")]: {
    backgroundImage: "none",
    padding: "32px 16px",
    minWidth: "0",
  },
})

const ProgramContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  width: "100%",
  maxWidth: "1276px",
})

const ProgramSectionTitle = styled.div({
  display: "flex",
  flexDirection: "column",
  alignSelf: "stretch",
  alignItems: "center",
  textAlign: "center",
  gap: "8px",
  paddingBottom: "48px",
  color: theme.custom.colors.darkGray2,
  borderBottom: `1px solid ${theme.custom.colors.red}`,
})

const FoundationalCarouselContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "48px",
  padding: "48px 0",
  maxWidth: "1276px",
  width: "100%",
  [theme.breakpoints.down("md")]: {
    gap: "16px",
    padding: "32px 0",
  },
})

const ProgramSectionHeader = styled.div({
  display: "flex",
  flexDirection: "column",
  alignSelf: "stretch",
  alignItems: "center",
  textAlign: "center",
})

const CardImage = styled(Image)({
  display: "block",
  width: "auto",
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
  paddingBottom: "32px",
  width: "100%",
  height: "157px",
})

const IndustrySpecificCarouselContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  gap: "48px",
  width: "100%",
  [theme.breakpoints.down("md")]: {
    gap: "16px",
  },
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

const MobileCards = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
})

const FAQSection = styled.div({
  display: "flex",
  backgroundColor: theme.custom.colors.lightGray1,
  color: theme.custom.colors.darkGray2,
  width: "100%",
  minWidth: "1276px",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  [theme.breakpoints.down("md")]: {
    minWidth: "0",
  },
})

const FAQContainerOuter = styled.div({
  display: "flex",
  justifyContent: "center",
  padding: "80px 200px",
  width: "100%",
  [theme.breakpoints.down("md")]: {
    padding: "32px 16px",
  },
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

const FAQImageContainerOuter = styled.div({
  display: "flex",
  position: "relative",
  marginRight: "80px",
  width: "50%",
  height: "500px",
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
})

const FAQImageRedRing = styled(Image)({
  position: "absolute",
  left: "-100px",
  bottom: "-100px",
  transform: "rotate(5deg)",
})

const FAQImageContainerInner = styled.div({
  display: "flex",
  position: "relative",
  width: "100%",
  borderRadius: "12px 200px",
  overflow: "hidden",
  img: {
    objectFit: "cover",
  },
})

const FAQItemContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "32px",
  width: "50%",
  [theme.breakpoints.down("md")]: {
    width: "100%",
  },
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

/*
  Since Hubspot only provides an injectable script to render forms, we have
  to manually style everything based on their classes.
*/
const HubspotFormSection = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "40px",
  paddingTop: "80px",
  width: "100%",
  minWidth: "1276px",
  backgroundColor: theme.custom.colors.white,
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  "#hubspotPlaceholders": {
    display: "none",
  },
  "#hubspotContainer": {
    display: "flex",
    justifyContent: "center",
    padding: "0 200px 80px 200px",
    width: "100%",
    [theme.breakpoints.down("md")]: {
      padding: "0",
      minWidth: "0",
    },
  },
  [theme.breakpoints.down("md")]: {
    padding: "32px 16px",
    minWidth: "0",
  },
})

const FAQItem: React.FC<{
  question: string
  answer: string | React.ReactElement
}> = ({ question, answer }) => {
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
      <AccordionDetails>{answer}</AccordionDetails>
    </FAQAccordion>
  )
}

const HubspotForm: React.FC = () => {
  /*
    Hubspot only provides an injectable script to render forms. This component
    dynamically loads the script and renders the form in a div with id 'hubspotForm'.

    To style the form to match Smoot Design, we create hidden elements with
    Smoot Design components to extract their computed styles and apply them
    to the Hubspot form via a dynamically created stylesheet.

    This is a terrible hack, and it should be replaced with usage of Hubspot's API
    to create custom forms that we can fully control the markup and styling of.
  */
  useEffect(() => {
    const script = document.createElement("script")
    script.src = "https://js.hsforms.net/forms/v2.js"
    document.body.appendChild(script)

    script.addEventListener("load", () => {
      // @ts-expect-error hubspot directly mutates window
      if (window.hbspt) {
        // @ts-expect-error hubspot directly mutates window
        window.hbspt.forms.create({
          portalId: "4994459",
          formId: "60a1983b-361a-4e80-a0db-d24ff636d7bf",
          target: "#hubspotForm",
        })
      }
    })
  }, [])

  const hiddenInputRef = useRef<HTMLInputElement>(null)
  const hiddenLabelRef = useRef<HTMLLabelElement>(null)
  const hiddenSelectRef = useRef<HTMLSelectElement>(null)
  const hiddenMenuItemRef = useRef<HTMLLIElement>(null)
  const hiddenButtonRef = useRef<HTMLButtonElement>(null)

  const getCssString = (obj: CSSStyleDeclaration) => {
    if (!obj) return ""
    const allStyles: Record<string, string> = {}
    for (let i = 0; i < obj.length; i++) {
      const key = obj[i]
      allStyles[key] = obj.getPropertyValue(key)
    }
    return Object.entries(allStyles)
      .map(([property, value]) => `${property}: ${value};`)
      .join("\n  ")
  }

  useEffect(() => {
    if (
      hiddenInputRef.current &&
      hiddenLabelRef.current &&
      hiddenSelectRef.current &&
      hiddenMenuItemRef.current &&
      hiddenButtonRef.current
    ) {
      const computedInputStyles = window.getComputedStyle(
        hiddenInputRef.current,
      )
      const computedLabelStyles = window.getComputedStyle(
        hiddenLabelRef.current,
      )
      const computedSelectStyles = window.getComputedStyle(
        hiddenSelectRef.current,
      )
      const computedMenuItemStyles = window.getComputedStyle(
        hiddenMenuItemRef.current,
      )
      const computedButtonStyles = window.getComputedStyle(
        hiddenButtonRef.current,
      )

      const inputCssString = getCssString(computedInputStyles)
      const labelCssString = getCssString(computedLabelStyles)
      const selectCssString = getCssString(computedSelectStyles)
      const menuItemCssString = getCssString(computedMenuItemStyles)
      const buttonCssString = getCssString(computedButtonStyles)

      const styleSheet = document.createElement("style")
      styleSheet.textContent = `
      #hubspotForm {
        width: 100%;
        max-width: 1276px;
        form {
          display: flex;
          flex-direction: column;
          gap: 40px;
          width: 100%;
          fieldset {
            display: flex;
            max-width: 1276px;
            .hs-form-field {
              width: 100%;
              .hs-error-msgs {
                display: none;
              }
            }
          }
          label {
            .hs-form-required {
              color: ${theme.custom.colors.red};
            }
            ${labelCssString}
          }
          input[type="text"], input[type="email"] {
            width: 100% !important;
            ${inputCssString}
          }
          input[type="text"]:hover, input[type="email"]:hover,
          input[type="text"]:focus, input[type="email"]:focus {
            border-color: ${theme.custom.colors.darkGray2};
            border-width: 2px;
          }
          select {
            padding-left: 8px !important;
            width: 100% !important;
            ${selectCssString}
            option {
              ${menuItemCssString}
            }
          }
          input[type="submit"] {
            ${buttonCssString}
          }
          input[type="submit"]:hover {
            background-color: ${theme.custom.colors.red};
          }
          ${`@media (max-width: ${theme.breakpoints.values.md}px)`} {
            input[type="submit"] {
              width: 100%;
            }
          }
        }
      }
      `
      document.head.appendChild(styleSheet)
    }
  }, [])

  return (
    <div id="hubspotContainer">
      <div id="hubspotPlaceholders">
        <Input id="inputPlaceholder" ref={hiddenInputRef} />
        <Typography
          id="labelPlaceholder"
          variant="subtitle2"
          ref={hiddenLabelRef}
        />
        <SelectField
          id="selectPlaceholder"
          label="Placeholder"
          displayEmpty
          ref={hiddenSelectRef}
          value="placeholder"
        >
          <MenuItem id="menuItemPlaceholder1" value="placeholder">
            Placeholder
          </MenuItem>
        </SelectField>
        <MenuItem
          id="menuItemPlaceholder2"
          ref={hiddenMenuItemRef}
          value="placeholder"
        >
          Placeholder
        </MenuItem>
        <Button id="buttonPlaceholder" size="large" ref={hiddenButtonRef}>
          Placeholder
        </Button>
      </div>
      <div id="hubspotForm">
        <Stack direction={"column"} gap={2}>
          <Stack direction="row" gap={2}>
            <Skeleton variant="rectangular" height={32} width={200} />
            <Skeleton variant="rectangular" height={32} width={200} />
          </Stack>
          <Skeleton variant="rectangular" height={32} width={416} />
          <Skeleton variant="rectangular" height={32} width={416} />
          <Skeleton variant="rectangular" height={32} width={416} />
          <Skeleton variant="rectangular" height={32} width={416} />
          <Skeleton variant="rectangular" height={32} width={416} />
          <Skeleton variant="rectangular" height={32} width={416} />
          <Skeleton variant="rectangular" height={32} width={416} />
        </Stack>
      </div>
    </div>
  )
}

const UAILandingPage: React.FC = () => {
  const foundationalCarouselItems = [
    {
      image: "/images/uai_landing/cards/hands-on-deep-learning.jpg",
      title: "Hands-On Deep Learning",
    },
    {
      image: "/images/uai_landing/cards/large-language-models.jpg",
      title: "Large Language Models",
    },
    {
      image:
        "/images/uai_landing/cards/generative-ai-future-of-work-human-creativity.jpg",
      title: "Generative AI, the Future of Work, and Human Creativity",
    },
    {
      image: "/images/uai_landing/cards/multimodal-ai.jpg",
      title: "Multimodal AI",
    },
    {
      image: "/images/uai_landing/cards/explanation-reasoning-ai-ethics.jpg",
      title: "Explanation, Reasoning, and AI Ethics",
    },
  ]
  const domainSpecificCarouselItems = [
    {
      image: "/images/uai_landing/cards/ai-sustainability-transportation.jpg",
      title: "AI + Sustainability: Transportation",
    },
    {
      image: "/images/uai_landing/cards/ai-sustainability-energy.jpg",
      title: "AI + Sustainability: Energy",
    },
    {
      image: "/images/uai_landing/cards/ai-entrepreneurship.jpg",
      title: "AI + Entrepreneurship",
    },
    {
      image: "/images/uai_landing/cards/ai-healthcare.jpg",
      title: "AI + Healthcare",
    },
    {
      image: "/images/uai_landing/cards/ai-finance.jpg",
      title: "AI + Finance",
    },
    {
      image: "/images/uai_landing/cards/ai-agriculture.jpg",
      title: "AI + Agriculture",
    },
  ]

  const faqItems = [
    {
      question: "Who is Universal AI for?",
      answer: (
        <>
          Universal AI is a flexible curriculum designed for the needs of a
          variety of institutions including universities and companies.
          <br />
          <br />
          For universities looking to:
          <ul>
            <li>Access the latest AI research and knowledge</li>
            <li>Complement and fill curriculum gaps</li>
            <li>Offer elective or add-on programs to students</li>
          </ul>
          For companies looking to:
          <ul>
            <li>Improve business processes, innovations, and outcomes</li>
            <li>Close the AI knowledge gap amongst employees</li>
            <li>Invest in their talent pipelines</li>
          </ul>
        </>
      ),
    },
    {
      question: "What does a module look like?",
      answer:
        "Universal AI is entirely self-paced and asynchronous, allowing learners to progress at their own speed. Each module is comprised of 4-8 lectures accompanied by knowledge checks, guided exercises, and assignments. Learners can get help and ask questions from the AskTIM AI tutor.",
    },
    {
      question: "Are there hands-on exercises?",
      answer:
        "Hands-on exercises, led by MIT teaching assistants, accompany each module. Building on the theories and concepts introduced in the lectures, the TA’s ask learners to apply them to real-world examples using provided codes to complete the assignments.",
    },
    {
      question: "What is the AI tutor? How does it work?",
      answer:
        "The AI tutor, AskTIM, supports a more personalized Universal AI learning experience on the MIT Learn platform. Learners can interact with the AskTIM chatbot to ask questions about the lectures and exercises or get help on homework and knowledge checks. AskTIM can also help learners chart their unique learning journey through the Universal AI curriculum based on their specific goals.",
    },
    {
      question: "Can learners earn certificates?",
      answer:
        "Yes, learners earn and stack certificates as they progress through the curriculum. Learners earn a Universal AI Module Certificate after successfully completing a module. These can be stacked towards a Universal AI Foundations Series Certificate (earned after completing all foundational modules) and a Universal AI Program Certificate (earned after completing all foundational modules plus at least one vertical module).",
    },
  ]

  const [foundationalArrowsRef, setFoundationalArrowsRef] =
    React.useState<HTMLDivElement | null>(null)
  const foundationalArrows = (
    <ArrowButtonsContainer
      role="group"
      aria-label="Slide navigation"
      ref={setFoundationalArrowsRef}
    />
  )
  const [domainSpecificArrowsRef, setDomainSpecificArrowsRef] =
    React.useState<HTMLDivElement | null>(null)
  const domainSpecificArrows = (
    <ArrowButtonsContainer
      role="group"
      aria-label="Slide navigation"
      ref={setDomainSpecificArrowsRef}
    />
  )

  const foundationalCards = foundationalCarouselItems.map((item, index) => (
    <Card key={index} size="medium">
      <Card.Content>
        <CardImage src={item.image} alt="" height={170} width={298} />
        <CardText>
          <Typography variant="h5" color={theme.custom.colors.darkGray2}>
            {item.title}
          </Typography>
        </CardText>
      </Card.Content>
    </Card>
  ))

  const domainSpecificCards = domainSpecificCarouselItems.map((item, index) => (
    <Card key={index} size="medium">
      <Card.Content>
        <CardImage src={item.image} alt="" height={170} width={298} />
        <CardText>
          <Typography variant="h5" color={theme.custom.colors.darkGray2}>
            {item.title}
          </Typography>
        </CardText>
      </Card.Content>
    </Card>
  ))

  return (
    <PageContainer>
      <GradientWrapper>
        <TopSection>
          <HeaderContainer>
            <TopHeader>
              <TopHeaderText variant="h1">
                Equip your institution with resilient AI education
              </TopHeaderText>
              <SubheaderText>
                Build the AI competencies and strategic thinking required to
                drive innovation and solve real-world problems.
              </SubheaderText>
            </TopHeader>
            <HeroContainerOuter>
              <HeroContainerInner>
                <HeroText>
                  <HeroHeaderText>
                    A dynamic online learning experience
                  </HeroHeaderText>
                  <HeroSubheaderText>
                    With Universal AI, MIT experts equip learners from
                    universities and companies with a shared language and
                    understanding of the possibilities and limitations of AI –
                    from the theoretical foundations to real-world applications
                    across industries.
                  </HeroSubheaderText>
                  <HeroTextCard>
                    <Typography variant="body1">
                      Gain a robust understanding of the theories, concepts, and
                      problem-solving approaches of AI systems.
                    </Typography>
                  </HeroTextCard>
                  <HeroTextCard>
                    <Typography variant="body1">
                      Identify opportunities to increase efficiency and improve
                      decision-making in the workplace.
                    </Typography>
                  </HeroTextCard>
                  <HeroTextCard>
                    <Typography variant="body1">
                      Apply competencies in domain-specific contexts based on
                      personal or professional interests.
                    </Typography>
                  </HeroTextCard>
                  <InquireButton href="#hubspotSection">
                    Learn More
                  </InquireButton>
                </HeroText>
                <HeroImage>
                  <Image
                    alt=""
                    src="/images/uai_landing/uai-landing-hero-2.jpg"
                    sizes={`(max-width: ${theme.breakpoints.values.md}px) 50vw, 100vw`}
                    fill
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
            <HeaderText>What to expect</HeaderText>
            <SubheaderText>
              Universal AI consists of foundational and vertical modules that
              teach the underlying theories, concepts, and technologies of
              artificial intelligence. The self-paced experience is augmented by
              AI tutors that provide personalized support to learners.
            </SubheaderText>
          </ProgramSectionTitle>
          <FoundationalCarouselContainer>
            <ProgramSectionHeader>
              <Typography
                variant="h4"
                color={theme.custom.colors.darkGray2}
                gutterBottom
              >
                Foundational Modules
              </Typography>
              <Typography variant="body1" color={theme.custom.colors.darkGray2}>
                Designed to teach AI fluency for all learners, the foundational
                modules are grounded in real-world case studies rather than
                traditional mathematical models and principles. Selected modules
                include:
              </Typography>
            </ProgramSectionHeader>
            <DesktopOnly>
              <CarouselContainer>
                <StyledCarousel arrowsContainer={foundationalArrowsRef}>
                  {foundationalCards}
                </StyledCarousel>
              </CarouselContainer>
            </DesktopOnly>
            {foundationalArrows}
            <MobileOnly>
              <MobileCards>{foundationalCards}</MobileCards>
            </MobileOnly>
          </FoundationalCarouselContainer>
          <BracketSeparator />
          <IndustrySpecificCarouselContainer>
            <ProgramSectionHeader>
              <Typography
                variant="h4"
                color={theme.custom.colors.darkGray2}
                gutterBottom
              >
                Domain-Specific Vertical Modules
              </Typography>
              <Typography variant="body1" color={theme.custom.colors.darkGray2}>
                Building on the foundational material, the vertical modules
                apply AI concepts to specific industries and trending topic
                areas. Selected modules include:
              </Typography>
            </ProgramSectionHeader>
            <DesktopOnly>
              <CarouselContainer>
                <StyledCarousel arrowsContainer={domainSpecificArrowsRef}>
                  {domainSpecificCards}
                </StyledCarousel>
              </CarouselContainer>
            </DesktopOnly>
            {domainSpecificArrows}
            <MobileOnly>
              <MobileCards>{domainSpecificCards}</MobileCards>
            </MobileOnly>
            <InquireButton href="#hubspotSection">Learn More</InquireButton>
          </IndustrySpecificCarouselContainer>
        </ProgramContainer>
      </ProgramSection>
      <FAQSection>
        <FAQContainerOuter>
          <FAQContainerInner>
            <FAQHeader>
              <HeaderText>Frequently Asked Questions</HeaderText>
              <SubheaderText>
                Created by a team of 20+ faculty and experts from across MIT,
                Universal AI offers a self-paced learning experience focused on
                real-world application.
              </SubheaderText>
            </FAQHeader>
            <FAQWrapper>
              <FAQImageContainerOuter>
                <FAQImageRedRing
                  alt=""
                  src="/images/uai_landing/uai-faq-red-ring.svg"
                  width={520}
                  height={491}
                />
                <FAQImageContainerInner>
                  <Image
                    alt=""
                    src="/images/uai_landing/uai-faq.jpg"
                    sizes={`(max-width: ${theme.breakpoints.values.md}px) 50vw, 100vw`}
                    fill
                  />
                </FAQImageContainerInner>
              </FAQImageContainerOuter>
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
              <InquireButton href="#hubspotSection">Learn More</InquireButton>
            </FAQInquireButtonContainer>
          </FAQContainerInner>
        </FAQContainerOuter>
      </FAQSection>
      <HubspotFormSection id="hubspotSection">
        <HeaderText>
          Get in touch to learn more about Universal AI from MIT Open Learning
        </HeaderText>
        <HubspotForm />
      </HubspotFormSection>
    </PageContainer>
  )
}

export { UAILandingPage }
