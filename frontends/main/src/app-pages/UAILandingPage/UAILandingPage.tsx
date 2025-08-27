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

const TopSubheaderText = styled(Typography)({
  ...theme.typography.h5,
  [theme.breakpoints.down("md")]: {
    textAlign: "center",
    ...theme.typography.subtitle1,
  },
})

const HeroText = styled.div({
  display: "flex",
  flexDirection: "column",
  padding: "56px 56px 56px 0",
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
  ...theme.typography.h2,
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
  objectFit: "cover",
  flexGrow: 1,
  borderRadius: "8px",
  overflow: "hidden",
  width: "50%",
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
  backgroundColor: theme.custom.colors.white,
  backgroundImage: "url('/images/backgrounds/uai_landing_background.svg')",
  backgroundRepeat: "no-repeat",
  color: theme.custom.colors.lightGray2,
  width: "100%",
  minWidth: "1276px",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  [theme.breakpoints.down("md")]: {
    backgroundImage: "none",
    minWidth: "0",
  },
})

const ProgramContainer = styled.div({
  padding: "80px 200px",
  width: "100%",
  [theme.breakpoints.down("md")]: {
    padding: "32px 16px",
  },
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

const FAQImageContainer = styled.div({
  display: "flex",
  paddingRight: "80px",
  width: "50%",
  [theme.breakpoints.down("md")]: {
    display: "none",
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
  backgroundColor: theme.custom.colors.white,
  width: "100%",
  minWidth: "1276px",
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
  "#hubspotPlaceholders": {
    display: "none",
  },
  "#hubspotContainer": {
    display: "flex",
    justifyContent: "center",
    padding: "80px 200px",
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
        ></SelectField>
        <MenuItem id="menuItemPlaceholder" ref={hiddenMenuItemRef}>
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
            <TopHeaderText variant="h1" justifyContent="center">
              <TopHeaderText variant="h1" color={theme.custom.colors.lightRed}>
                Universal
              </TopHeaderText>{" "}
              AI Education from MIT
            </TopHeaderText>
            <TopSubheaderText>
              Preparing learners for a future powered by AI.
            </TopSubheaderText>
            <HeroContainerOuter>
              <HeroContainerInner>
                <HeroText>
                  <HeroHeaderText>
                    Learning content, for everyone
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
                      decision making in the workplace.
                    </Typography>
                  </HeroTextCard>
                  <HeroTextCard>
                    <Typography variant="body1">
                      Apply competencies in domain-specific contexts based on
                      personal or professional interests.
                    </Typography>
                  </HeroTextCard>
                  <InquireButton href="#hubspotContainer">
                    Learn More
                  </InquireButton>
                </HeroText>
                <HeroImage>
                  <Image
                    alt=""
                    src="/images/uai_landing/uai-landing-hero-2.jpg"
                    layout="fill"
                    objectFit="cover"
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
            <DesktopOnly>
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
            </DesktopOnly>
            {arrows}
            <InquireButton href="#hubspotContainer">Learn More</InquireButton>
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
              <InquireButton href="#hubspotContainer">Learn More</InquireButton>
            </FAQInquireButtonContainer>
          </FAQContainerInner>
        </FAQContainerOuter>
      </FAQSection>
      <HubspotFormSection>
        <HubspotForm />
      </HubspotFormSection>
    </PageContainer>
  )
}

export { UAILandingPage }
