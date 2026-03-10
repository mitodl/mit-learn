import React from "react"
import { ButtonLink, styled } from "@mitodl/smoot-design"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { Skeleton } from "ol-components"
import type {
  BaseProgram,
  V2ProgramDetail,
} from "@mitodl/mitxonline-api-axios/v2"
import { parseReqTree } from "./util"
import { formatPrice } from "@/common/mitxonline"
import { useQuery } from "@tanstack/react-query"
import { programPageView } from "@/common/urls"

const WideButtonLink = styled(ButtonLink)({
  width: "100%",
})

const BundleUpsellContainer = styled.div(({ theme }) => ({
  boxShadow: "inset 0px 16px 24px 0px rgba(0, 40, 150, 0.05)",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  [theme.breakpoints.up("md")]: {
    borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
    padding: "24px 32px",
  },
  // Tablet: standalone bordered card in the right column
  [theme.breakpoints.between("sm", "md")]: {
    border: `1px solid ${theme.custom.colors.lightGray2}`,
    borderRadius: "4px",
    padding: "24px",
  },
  [theme.breakpoints.down("sm")]: {
    borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
    padding: "24px 16px",
  },
}))

const BundleUpsellItem = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  textAlign: "center",
  "& + &": {
    paddingTop: "16px",
    [theme.breakpoints.between("sm", "md")]: {
      borderTop: `1px solid ${theme.custom.colors.lightGray2}`,
      paddingTop: "24px",
    },
  },
  [theme.breakpoints.between("sm", "md")]: {
    flexDirection: "row",
    textAlign: "left",
    alignItems: "center",
    gap: "32px",
  },
}))

const BundleUpsellActions = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  alignItems: "center",
  [theme.breakpoints.between("sm", "md")]: {
    marginLeft: "auto",
    gap: "8px",
  },
}))

const BundlePrice = styled.span(({ theme }) => ({
  ...theme.typography.h4,
  display: "block",
  color: theme.custom.colors.red,
}))

const BundleDiscount = styled.span(({ theme }) => ({
  ...theme.typography.body1,
  display: "block",
  color: theme.custom.colors.darkGray2,
}))

const BundlePriceRow = styled.div(({ theme }) => ({
  display: "flex",
  gap: "8px",
  alignItems: "center",
  justifyContent: "center",
  [theme.breakpoints.between("sm", "md")]: {
    justifyContent: "flex-start",
  },
}))

const BundleUpsellTitle = styled.span(({ theme }) => ({
  ...theme.typography.h5,
  display: "block",
}))

// For now we use a static 19% discount that is aligned with business rules
const BUNDLE_DISCOUNT_LABEL = "(19% off)"

type ProgramBundleUpsellItemProps =
  | { loading: true; program?: undefined }
  | { loading?: false; program: V2ProgramDetail }

const ProgramBundleUpsellItem: React.FC<ProgramBundleUpsellItemProps> = ({
  loading,
  program,
}) => {
  if (loading) {
    return (
      <BundleUpsellItem>
        <BundleUpsellTitle>
          <Skeleton width="80%" variant="text" sx={{ mx: "auto" }} />
          <Skeleton
            width="60%"
            variant="text"
            sx={(theme) => ({
              mx: "auto",
              [theme.breakpoints.between("sm", "md")]: {
                display: "none",
              },
            })}
          />
        </BundleUpsellTitle>
        <BundleUpsellActions>
          <BundlePriceRow>
            <BundlePrice>
              <Skeleton width={60} variant="text" />
            </BundlePrice>
            <BundleDiscount>
              <Skeleton width={50} variant="text" />
            </BundleDiscount>
          </BundlePriceRow>
          <Skeleton width="100%" variant="rectangular" height={40} />
        </BundleUpsellActions>
      </BundleUpsellItem>
    )
  }

  const price = program.products[0]?.price
  const priceFormatted = price ? formatPrice(price, { avoidCents: true }) : null
  if (!priceFormatted) return null

  const parsedReqs = parseReqTree(program.req_tree)
  const totalCourses = parsedReqs.reduce(
    (sum, req) => sum + req.requiredCourseCount,
    0,
  )

  return (
    <BundleUpsellItem data-testid="program-bundle-upsell-item">
      <BundleUpsellTitle>
        Get all {totalCourses} {program.title} Courses + Certificates
      </BundleUpsellTitle>
      <BundleUpsellActions>
        <BundlePriceRow>
          <BundlePrice>{priceFormatted}</BundlePrice>
          <BundleDiscount>{BUNDLE_DISCOUNT_LABEL}</BundleDiscount>
        </BundlePriceRow>
        <WideButtonLink
          variant="bordered"
          size="large"
          href={programPageView(program)}
        >
          View Program
        </WideButtonLink>
      </BundleUpsellActions>
    </BundleUpsellItem>
  )
}

const ProgramBundleUpsell: React.FC<{ programs: BaseProgram[] }> = ({
  programs,
}) => {
  const ids = programs.map((p) => p.id)
  const { data, isLoading, isError } = useQuery({
    ...programsQueries.programsList({ id: ids }),
    enabled: ids.length > 0,
  })

  const pricedPrograms = (data?.results ?? []).filter(
    (d): d is V2ProgramDetail => !!d.products[0]?.price,
  )

  if (!isLoading && pricedPrograms.length === 0) {
    if (isError) {
      console.warn(
        `ProgramBundleUpsell: programs list query failed for ids=${ids.join(",")}`,
      )
    }
    return null
  }

  return (
    <BundleUpsellContainer data-testid="program-bundle-upsell">
      {isLoading
        ? programs.map((p) => <ProgramBundleUpsellItem key={p.id} loading />)
        : pricedPrograms.map((program) => (
            <ProgramBundleUpsellItem key={program.id} program={program} />
          ))}
    </BundleUpsellContainer>
  )
}

export default ProgramBundleUpsell
export { BUNDLE_DISCOUNT_LABEL }
