import React, { useCallback, useState } from "react"
import {
  Button,
  ChipLink,
  Container,
  Grid,
  useMuiBreakpointAtLeast,
  SearchInput,
} from "ol-design"
import type { SearchInputProps } from "ol-design"
import { GridContainer } from "../components/layout"
import { TitledCarousel } from "ol-util"
import ArrowBack from "@mui/icons-material/ArrowBack"
import ArrowForward from "@mui/icons-material/ArrowForward"
import LearningResourceCard from "../components/LearningResourceCard"
import type { PaginatedLearningResourceList } from "api"
import { useLearningResourcesList } from "api/hooks/learningResources"
import { UseQueryResult } from "@tanstack/react-query"
import styled from "@emotion/styled"
import { Theme } from "../entry/theme"
import { mediaQueries } from "ol-util"

interface HomePageCarouselProps {
  query: UseQueryResult<PaginatedLearningResourceList>
  showNavigationButtons?: boolean
  title: React.ReactNode
}

const CarouselButton = styled(Button)`
  padding: 10px;
  padding-left: 15px;
  padding-right: 15px;
  margin-right: 0.5em;
  margin-left: 0.5em;
`

const HomePageCarousel: React.FC<HomePageCarouselProps> = ({
  query,
  showNavigationButtons = true,
  title,
}) => {
  const aboveSm = useMuiBreakpointAtLeast("sm")
  const aboveLg = useMuiBreakpointAtLeast("lg")
  const pageSize = aboveLg ? 4 : aboveSm ? 2 : 1

  return (
    <TitledCarousel
      title={title}
      as="section"
      pageSize={pageSize}
      carouselClassName="ic-carousel"
      cellSpacing={0} // we'll handle it with css
      previous={
        <CarouselButton
          variant="outlined"
          color="secondary"
          startIcon={<ArrowBack fontSize="inherit" />}
        >
          Previous
        </CarouselButton>
      }
      next={
        <CarouselButton
          variant="outlined"
          color="secondary"
          endIcon={<ArrowForward fontSize="inherit" />}
        >
          Next
        </CarouselButton>
      }
      showNavigationButtons={showNavigationButtons}
    >
      {query.data?.results?.map((resource) => (
        <LearningResourceCard
          key={resource.id}
          className="ic-resource-card ic-carousel-card"
          resource={resource}
          variant="column"
        />
      ))}
    </TitledCarousel>
  )
}

const EXPLORE_BUTTONS = [
  {
    label: "Courses",
  },
  {
    label: "Videos",
  },
  {
    label: "Podcasts",
  },
  {
    label: "Learning Paths",
  },
  {
    label: "By Department",
  },
  {
    label: "By Subject",
  },
  {
    label: "From OCW",
  },
  {
    label: "From MITx",
  },
  {
    label: "With Certificate",
  },
  {
    label: "Micromasters",
  },
  {
    label: "Professional Education",
  },
]

const HomePageContainer = styled(Container)`
  margin-bottom: 3.5rem;

  h3 {
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 8px;
  }
`

const TopContainer = styled(GridContainer)`
  margin-top: 3.5rem;
  margin-bottom: 3.5rem;
`

interface ThemeProps {
  theme?: Theme
}

const BackgroundGradient = styled.div<ThemeProps>`
  position: absolute;
  top: 0;
  left: 0;
  z-index: -100;
  height: 615px;
  background-image: ${({ theme }) =>
    `linear-gradient(${theme.colorBlue1}, ${theme.colorGray1})`};
  width: 100%;
`

const PageTitle = styled.h1<ThemeProps>`
  margin-bottom: 0.5rem;
  font-size: 50px;
  color: ${({ theme }) => theme.colorBlue5};
`

const StyledSearchInput = styled(SearchInput)<ThemeProps>`
  margin-top: 1.75rem;
  margin-bottom: 1.75rem;

  background-color: ${({ theme }) => theme.colorBackgroundLight};

  &.MuiInputBase-root {
    max-width: 520px;
    width: 100%;
    border-radius: 3px;
    font-size: 1.25rem;

    fieldset {
      border: 2px solid ${({ theme }) => theme.colorGray4};
    }

    &.Mui-focused fieldset {
      border-color: ${({ theme }) => theme.colorBlue5};
    }

    &.Mui-focused .MuiSvgIcon-root {
      color: ${({ theme }) => theme.colorBlue5};
    }
  }

  .MuiInputBase-input {
    &::placeholder {
      font-size: 1rem;
    }
  }

  .MuiButton-root {
    border-radius: 3px;
    padding: 10px;
  }
`

const SearchButtonsContainer = styled.div`
  max-width: 520px;
`

const StyledChipLink = styled(ChipLink)`
  margin: 8px 16px 8px 0;
`

const FrontPageImage = styled.img`
  height: 435px;
  ${mediaQueries.down("md")} {
    display: none;
  }
`

const HomePage: React.FC = () => {
  const [searchText, setSearchText] = useState("")
  const onSearchClear = useCallback(() => setSearchText(""), [])
  const onSearchChange: SearchInputProps["onChange"] = useCallback((e) => {
    setSearchText(e.target.value)
  }, [])
  const onSearchSubmit: SearchInputProps["onSubmit"] = useCallback((e) => {
    console.log("Submitting search")
    console.log(e)
  }, [])
  const resourcesQuery = useLearningResourcesList()

  return (
    <HomePageContainer className="homepage">
      <TopContainer>
        <BackgroundGradient />
        <Grid item xs={12} md={7}>
          <PageTitle>Learn from MIT</PageTitle>
          <h2>
            Search for MIT courses, videos, podcasts, learning paths, and
            communities
          </h2>
          <StyledSearchInput
            value={searchText}
            placeholder="What do you want to learn?"
            onSubmit={onSearchSubmit}
            onClear={onSearchClear}
            onChange={onSearchChange}
          />
          <div>
            <h3>Explore</h3>
            <SearchButtonsContainer>
              {EXPLORE_BUTTONS.map(({ label }) => (
                <StyledChipLink
                  color="secondary"
                  to=""
                  key={label}
                  label={label}
                />
              ))}
            </SearchButtonsContainer>
          </div>
        </Grid>
        <Grid item xs={12} md={5}>
          <div>
            <FrontPageImage
              alt="Photos from the MIT campus arranged to form the letter M"
              src="/static/images/infinite-front-page-image.png"
            />
          </div>
        </Grid>
      </TopContainer>
      <HomePageCarousel
        title={<h2>Upcoming Courses</h2>}
        query={resourcesQuery}
      />
    </HomePageContainer>
  )
}

export default HomePage
