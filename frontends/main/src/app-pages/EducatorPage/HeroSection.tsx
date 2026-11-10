"use client"

import React, { useCallback, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next-nprogress-bar"
import { Breadcrumbs, styled } from "ol-components"
import type { SearchInputProps } from "ol-components"
import { Button } from "@mitodl/smoot-design"
import {
  RiBookOpenLine,
  RiFileCopy2Line,
  RiYoutubeLine,
} from "@remixicon/react"
import { SearchField } from "@/page-components/SearchField/SearchField"
import { analytics } from "@/common/analytics"
import { HOME, querifiedSearchUrl } from "@/common/urls"
import { Section, SectionInner } from "./SectionLayout"
import {
  SEARCH_LECTURE_VIDEOS,
  SEARCH_OCW_COURSES,
  SEARCH_OPEN_TEXTBOOKS,
} from "./links"

const SHORTCUTS = [
  {
    icon: RiBookOpenLine,
    title: "Browse Open licensed courses",
    body: "by topic or department",
    href: SEARCH_OCW_COURSES,
  },
  {
    icon: RiYoutubeLine,
    title: "Find",
    body: "lecture videos",
    href: SEARCH_LECTURE_VIDEOS,
  },
  {
    icon: RiFileCopy2Line,
    title: "Explore",
    body: "open textbooks",
    href: SEARCH_OPEN_TEXTBOOKS,
  },
]

const HeroBand = styled(Section)(({ theme }) => ({
  position: "relative",
  overflow: "hidden",
  backgroundImage: `linear-gradient(110deg, ${theme.custom.colors.lightGray2} 0%, ${theme.custom.colors.white} 100%)`,
  borderBottom: `1px solid ${theme.custom.colors.lightGray2}`,
}))

/**
 * The line art is drawn portrait and rotated into place, as in the design.
 * Container query units size the rotated image to the landscape box.
 */
const Lines = styled.div(({ theme }) => ({
  position: "absolute",
  inset: "-83.39% -34.84% -97.27% -53.95%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  containerType: "size",
  pointerEvents: "none",
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}))

const LinesImage = styled(Image)({
  flex: "none",
  width: "100cqh",
  height: "100cqw",
  transform: "rotate(90deg)",
})

const Inner = styled(SectionInner)(({ theme }) => ({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: "40px",
  padding: "80px 0",
  [theme.breakpoints.down("md")]: {
    gap: "24px",
    padding: "32px 0",
  },
}))

const Copy = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
})

const Title = styled.h1(({ theme }) => ({
  ...theme.typography.h1,
  color: theme.custom.colors.black,
  margin: 0,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.h3,
  },
}))

const Subtitle = styled.p(({ theme }) => ({
  ...theme.typography.h4,
  color: theme.custom.colors.black,
  margin: 0,
  [theme.breakpoints.down("md")]: {
    ...theme.typography.h5,
  },
}))

const SearchRow = styled.div({
  display: "flex",
  width: "100%",
  maxWidth: "800px",
})

const StyledSearchField = styled(SearchField)({
  flex: 1,
  minWidth: 0,
  // SearchInput rounds every corner of the hero size with !important.
  "&&.MuiInputBase-sizeHero": {
    borderTopRightRadius: "0 !important",
    borderBottomRightRadius: "0 !important",
  },
})

const SearchButton = styled(Button)({
  flexShrink: 0,
  height: "auto",
  borderTopLeftRadius: 0,
  borderBottomLeftRadius: 0,
})

const Shortcuts = styled.ul(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: "32px",
  listStyle: "none",
  margin: 0,
  padding: "16px 0 0",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    gap: "0",
    padding: 0,
  },
}))

const Shortcut = styled(Link)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: "16px",
  padding: "16px 24px 16px 16px",
  border: "1px solid transparent",
  borderRadius: "4px",
  color: theme.custom.colors.darkGray2,
  "&:hover": {
    borderColor: theme.custom.colors.lightGray2,
    backgroundColor: theme.custom.colors.white,
  },
  svg: {
    flexShrink: 0,
    width: "32px",
    height: "32px",
  },
}))

const ShortcutTitle = styled.span(({ theme }) => ({
  ...theme.typography.subtitle1,
  display: "block",
  lineHeight: 1.5,
  color: theme.custom.colors.black,
}))

const ShortcutBody = styled.span(({ theme }) => ({
  ...theme.typography.body1,
  display: "block",
}))

const HeroSection: React.FC = () => {
  const router = useRouter()
  const [searchText, setSearchText] = useState("")

  // Scoped to OCW, like the shortcuts below: its courses are the openly
  // licensed ones this page is about.
  const search = useCallback(
    (query: string) =>
      router.push(querifiedSearchUrl({ q: query, offered_by: "ocw" })),
    [router],
  )

  const onSearchChange: SearchInputProps["onChange"] = useCallback((e) => {
    setSearchText(e.target.value)
  }, [])
  const onSearchClear = useCallback(() => setSearchText(""), [])
  const onSearchSubmit: SearchInputProps["onSubmit"] = useCallback(
    (e) => search(e.target.value),
    [search],
  )
  const onSearchButtonClick = () => {
    search(searchText)
    analytics.siteSearched({ query: searchText, isEnter: false })
  }

  return (
    <HeroBand>
      <Lines aria-hidden>
        <LinesImage
          src="/images/educator/hero-lines.svg"
          alt=""
          width={1526}
          height={3164}
          priority
        />
      </Lines>
      <Inner>
        <Breadcrumbs
          variant="light"
          ancestors={[{ href: HOME, label: "Home" }]}
          current="Educator"
        />
        <Copy>
          <Title>Bring MIT into your teaching</Title>
          <Subtitle>
            Free course materials from MIT classrooms, ready to use and adapt in
            yours.
          </Subtitle>
          <SearchRow>
            <StyledSearchField
              size="hero"
              fullWidth
              placeholder="Try linear algebra or climate"
              value={searchText}
              onChange={onSearchChange}
              onClear={onSearchClear}
              onSubmit={onSearchSubmit}
            />
            <SearchButton
              variant="primary"
              size="large"
              onClick={onSearchButtonClick}
            >
              Search
            </SearchButton>
          </SearchRow>
          <Shortcuts>
            {SHORTCUTS.map(({ icon: Icon, title, body, href }) => (
              <li key={href}>
                <Shortcut href={href}>
                  <Icon aria-hidden />
                  <span>
                    <ShortcutTitle>{title}</ShortcutTitle>
                    <ShortcutBody>{body}</ShortcutBody>
                  </span>
                </Shortcut>
              </li>
            ))}
          </Shortcuts>
        </Copy>
      </Inner>
    </HeroBand>
  )
}

export default HeroSection
