import React from "react"
import { ButtonLink, styled } from "@mitodl/smoot-design"
import { HeadingIds } from "./util"
import type { ProductNoun } from "./util"

const StyledLink = styled(ButtonLink)(({ theme }) => ({
  backgroundColor: theme.custom.colors.white,
  borderColor: theme.custom.colors.white,
  [theme.breakpoints.down("md")]: {
    backgroundColor: theme.custom.colors.lightGray1,
    border: `1px solid ${theme.custom.colors.lightGray2}`,
  },
}))

const LinksContainer = styled.nav(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  [theme.breakpoints.up("md")]: {
    gap: "24px",
    padding: "12px 16px",
    backgroundColor: theme.custom.colors.white,
    borderRadius: "4px",
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    boxShadow: "0 8px 20px 0 rgba(120, 147, 172, 0.10)",
    marginTop: "-24px",
    width: "calc(100%)",
  },
  [theme.breakpoints.down("md")]: {
    alignSelf: "center",
    gap: "8px",
    rowGap: "16px",
    padding: 0,
  },
}))

export type HeadingData = {
  id: HeadingIds
  label: string
  variant: "primary" | "secondary"
}

const ProductNavbar: React.FC<{
  navLinks: HeadingData[]
  productNoun: ProductNoun
}> = ({ navLinks, productNoun }) => {
  if (navLinks.length === 0) {
    return null
  }
  return (
    <LinksContainer aria-label={`${productNoun} Details`}>
      {navLinks.map((heading) => {
        const LinkComponent =
          heading.variant === "primary" ? ButtonLink : StyledLink
        return (
          <LinkComponent
            key={heading.id}
            href={`#${heading.id}`}
            variant={heading.variant}
            size="small"
          >
            {heading.label}
          </LinkComponent>
        )
      })}
    </LinksContainer>
  )
}

export default ProductNavbar
