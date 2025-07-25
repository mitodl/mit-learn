import React, { useEffect, useState } from "react"
import { shuffle } from "lodash"
import {
  Container,
  Typography,
  styled,
  theme,
  pxToRem,
  TruncateText,
  onReInitSlickA11y,
} from "ol-components"
import { ActionButton } from "@mitodl/smoot-design"
import { useTestimonialList } from "api/hooks/testimonials"
import type { Attestation } from "api/v0"
import { RiArrowRightLine, RiArrowLeftLine } from "@remixicon/react"
import Slider from "react-slick"
import AttestantBlock from "@/page-components/TestimonialDisplay/AttestantBlock"
import Image from "next/image"

const StyledActionButton = styled(ActionButton)(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  "&:hover:not(:disabled)": {
    // Picked via figma eyedropper.
    // Figma specifies multiple backgrounds, background: linear-gradient(...), brightRed
    // But that causes problems for the transition animation
    backgroundColor: "#FCF2F4",
  },
}))

const HeaderContainer = styled(Container)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: "8px",
  paddingBottom: "60px",
  [theme.breakpoints.down("md")]: {
    paddingBottom: "28px",
  },
}))

const Section = styled.section(({ theme }) => ({
  backgroundColor: theme.custom.colors.mitRed,
  color: theme.custom.colors.white,
  overflow: "auto",
  padding: "80px 0",
  [theme.breakpoints.down("md")]: {
    padding: "40px 0",
  },
  "h2, h3": {
    textAlign: "center",
  },
  h3: {
    marginTop: "8px",
    marginBottom: "60px",
    ...theme.typography.body1,
  },
}))

const OverlayContainer = styled.div({
  position: "relative",
  maxWidth: "1440px",
  margin: "0 auto",
  [theme.breakpoints.down("md")]: {
    maxWidth: "680px",
  },
  [theme.breakpoints.down("sm")]: {
    maxWidth: "344px",
  },
})

const TestimonialCardContainer = styled.div({
  maxWidth: "1440px",
  [theme.breakpoints.down("md")]: {
    padding: "0",
    maxWidth: "680px",
  },
  [theme.breakpoints.down("sm")]: {
    width: "344px",
  },
})

const TestimonialCard = styled.div({
  height: "326px",
  backgroundColor: theme.custom.colors.white,
  color: theme.custom.colors.black,
  display: "flex",
  borderRadius: "8px",
  margin: "0 0 50px 24px",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    margin: "0",
    width: "680px",
  },
  [theme.breakpoints.down("sm")]: {
    width: "344px",
    padding: "0 8px",
  },
})

const TestimonialCardImage = styled.div({
  height: "326px",
  img: {
    height: "326px",
    width: "300px",
    objectFit: "cover",
    objectPosition: "center",
    borderTopLeftRadius: "8px",
    borderBottomLeftRadius: "8px",
    [theme.breakpoints.down("md")]: {
      width: "100%",
      height: "190px",
      borderTopRightRadius: "8px",
      borderBottomLeftRadius: "0px",
    },
  },
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
})

const TestimonialCardQuote = styled.div({
  height: "326px",
  backgroundColor: theme.custom.colors.white,
  color: theme.custom.colors.black,
  padding: "0 32px 32px",
  alignSelf: "stretch",
  alignContent: "center",
  borderRadius: "8px",
  [theme.breakpoints.down("md")]: {
    width: "100%",
    height: "161px",
    padding: "32px",
  },
  [theme.breakpoints.down("sm")]: {
    height: "224px",
    marginTop: "16px",
    marginBottom: "0",
    padding: "0 16px",
    flexGrow: "1",
    ...theme.typography.subtitle1,
  },
})

const TestimonialQuoteOpener = styled.div(({ theme }) => ({
  color: theme.custom.colors.mitRed,
  fontStyle: "normal",
  fontWeight: theme.typography.fontWeightBold,
  height: pxToRem(56),
  width: "100%",
  fontSize: pxToRem(60),
  lineHeight: pxToRem(108),
  [theme.breakpoints.down("md")]: {
    fontWeight: theme.typography.fontWeightLight,
    height: pxToRem(20),
    lineHeight: pxToRem(64),
    transform: "translateY(-8px)",
  },
}))

const TestimonialFadeLeft = styled.div({
  position: "absolute",
  top: "0",
  bottom: "0",
  left: "0",
  width: "15%",
  background:
    "linear-gradient(270deg,rgb(117 0 20 / 0%) 0%,rgb(117 0 20 / 100%) 100%)",
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
})
const TestimonialFadeRight = styled.div({
  position: "absolute",
  top: "0",
  bottom: "0",
  right: "0",
  width: "15%",
  background:
    "linear-gradient(270deg, rgb(117 0 20 / 100%) 0%,rgb(117 0 20 / 0%) 100%)",
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
})

const RiArrowLeftLineStyled = styled(RiArrowLeftLine)({
  fontSize: "10rem",
})
const RiArrowRightLineStyled = styled(RiArrowRightLine)({
  fontSize: "10rem",
})

const ButtonsContainer = styled.div({
  display: "flex",
  justifyContent: "center",
  margin: "0 auto",
  gap: "16px",
  [theme.breakpoints.down("md")]: {
    marginTop: "20px",
  },
})

const TestimonialTruncateText = styled(TruncateText)({
  margin: "0px",
  textOverflow: "none",
  overflow: "hidden",
  ...theme.typography.h4,
  fontSize: pxToRem(20), // This is a unicorn font size per the Figma design - it's not used anywhere else.
  lineHeight: pxToRem(26),
  height: "182px",
  alignContent: "center",
  marginBottom: "0.75rem",
  [theme.breakpoints.down("md")]: {
    WebkitLineClamp: 7,
    ["@supports (-webkit-line-clamp: 7)"]: {
      WebkitLineClamp: 7,
    },
  },
  [theme.breakpoints.down("sm")]: {
    height: "208px",
    flexShrink: "0",
    ...theme.typography.subtitle1,
    WebkitLineClamp: 10,
    ["@supports (-webkit-line-clamp: 10)"]: {
      WebkitLineClamp: 10,
    },
    marginBottom: 0,
  },
})

const SlickCarousel = () => {
  const { data } = useTestimonialList({ position: 1 })
  const [slick, setSlick] = React.useState<Slider | null>(null)
  const [shuffled, setShuffled] = useState<Attestation[]>()
  const [imageSequence, setImageSequence] = useState<number[]>()

  useEffect(() => {
    if (!data) return
    setShuffled(shuffle(data?.results))
    setImageSequence(shuffle([1, 2, 3, 4, 5, 6]))
  }, [data])

  if (!data?.results?.length || !shuffled?.length) {
    return null
  }

  const settings = {
    ref: setSlick,
    onReInit: () => onReInitSlickA11y(slick),
    infinite: true,
    slidesToShow: 1,
    centerPadding: "15%",
    centerMode: true,
    arrows: false,
    responsive: [
      {
        breakpoint: theme.breakpoints.values["md"],
        settings: {
          centerMode: false,
        },
      },
    ],
  }

  return (
    <OverlayContainer as="section" aria-label="Carousel of learner experiences">
      <Slider {...settings}>
        {shuffled.map((resource, idx) => (
          <TestimonialCardContainer
            className="testimonial-card-container"
            key={`container-${resource.id}`}
          >
            <TestimonialCard
              key={`a-${resource.id}`}
              id={`testimonial-card-${resource.id}`}
              className="testimonial-card"
            >
              <TestimonialCardImage>
                <Image
                  src={`/images/testimonial_images/testimonial-image-${imageSequence![idx % 6]}.png`}
                  alt=""
                  width={300}
                  height={326}
                />
              </TestimonialCardImage>
              <TestimonialCardQuote>
                <TestimonialQuoteOpener aria-hidden>
                  &ldquo;
                </TestimonialQuoteOpener>
                <TestimonialTruncateText as="blockquote" lineClamp={7}>
                  {resource.quote.slice(0, 350)}
                  {resource.quote.length >= 350 ? "..." : ""}
                </TestimonialTruncateText>
                <AttestantBlock
                  attestation={resource}
                  avatarPosition="end"
                  color="dark"
                  avatarStyle="homepage"
                />
              </TestimonialCardQuote>
            </TestimonialCard>
          </TestimonialCardContainer>
        ))}
      </Slider>
      <TestimonialFadeLeft />
      <TestimonialFadeRight />
      <ButtonsContainer>
        <StyledActionButton
          aria-label="Show previous"
          variant="secondary"
          onClick={slick?.slickPrev}
        >
          <RiArrowLeftLineStyled aria-hidden />
        </StyledActionButton>
        <StyledActionButton
          aria-label="Show next"
          variant="secondary"
          onClick={slick?.slickNext}
        >
          <RiArrowRightLineStyled aria-hidden />
        </StyledActionButton>
      </ButtonsContainer>
    </OverlayContainer>
  )
}

const TestimonialsSection: React.FC = () => {
  return (
    <Section>
      <HeaderContainer>
        <Typography component="h2" typography={{ xs: "h3", sm: "h2" }}>
          From Our Community
        </Typography>
        <Typography variant="body1">
          Millions of learners are reaching their goals with MIT's non-degree
          learning resources. Here's what they're saying.
        </Typography>
      </HeaderContainer>
      <SlickCarousel />
    </Section>
  )
}

export default TestimonialsSection
