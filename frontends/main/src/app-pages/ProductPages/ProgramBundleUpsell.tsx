import React from "react"
import { ButtonLink, styled } from "@mitodl/smoot-design"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { Skeleton, Typography } from "ol-components"
import type {
  BaseProgram,
  V2ProgramDetail,
} from "@mitodl/mitxonline-api-axios/v2"
import { parseReqTree } from "./util"
import { formatPrice } from "@/common/mitxonline"
import { useQueries } from "@tanstack/react-query"
import { programPageView } from "@/common/urls"

const WideButtonLink = styled(ButtonLink)(({ theme }) => ({
  width: "100%",
  [theme.breakpoints.between("sm", "md")]: {
    width: "auto",
    marginLeft: "auto",
  },
}))

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
  gap: "24px",
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
  },
}))

const BundleUpsellText = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  [theme.breakpoints.between("sm", "md")]: {
    flex: 1,
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
  fontWeight: theme.typography.fontWeightRegular,
  "> strong": {
    fontWeight: theme.typography.fontWeightBold,
  },
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
        <BundleUpsellText>
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
          <BundlePriceRow>
            <BundlePrice>
              <Skeleton width={60} variant="text" />
            </BundlePrice>
            <BundleDiscount>
              <Skeleton width={50} variant="text" />
            </BundleDiscount>
          </BundlePriceRow>
        </BundleUpsellText>
        <Skeleton width="100%" variant="rectangular" height={40} />
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
      <BundleUpsellText>
        <BundleUpsellTitle>
          Get all {totalCourses} <strong>{program.title}</strong> Courses +
          Certificate
        </BundleUpsellTitle>
        <BundlePriceRow>
          <BundlePrice>{priceFormatted}</BundlePrice>
          <BundleDiscount>{BUNDLE_DISCOUNT_LABEL}</BundleDiscount>
        </BundlePriceRow>
      </BundleUpsellText>
      <WideButtonLink
        variant="bordered"
        href={programPageView(program.readable_id)}
      >
        View Program
      </WideButtonLink>
    </BundleUpsellItem>
  )
}

// Fetches full program details individually. Ideally we'd use the listing
// endpoint, but it doesn't include product/price info. In practice only 1–2
// programs are fetched per course.
const ProgramBundleUpsell: React.FC<{ programs: BaseProgram[] }> = ({
  programs,
}) => {
  const programDetails = useQueries({
    queries: programs.map((p) =>
      programsQueries.programDetail({ id: String(p.id) }),
    ),
  })

  const anyLoading = programDetails.some((q) => q.isLoading)
  const failedPrograms = programDetails.filter((q) => q.isError)
  const pricedPrograms = programDetails
    .map((q) => q.data)
    .filter((d): d is V2ProgramDetail => !!d && !!d.products[0]?.price)

  if (!anyLoading && pricedPrograms.length === 0) {
    if (failedPrograms.length > 0) {
      console.warn(
        `ProgramBundleUpsell: ${failedPrograms.length}/${programs.length} program detail queries failed`,
      )
    }
    return null
  }

  return (
    <BundleUpsellContainer data-testid="program-bundle-upsell">
      {anyLoading ? (
        <>
          <Skeleton width={80} height={20} sx={{ mx: "auto" }} />
          {programs.map((p) => (
            <ProgramBundleUpsellItem key={p.id} loading />
          ))}
        </>
      ) : (
        <>
          <Typography variant="body2" sx={{ textAlign: "center" }}>
            Best value
          </Typography>
          {pricedPrograms.map((program) => (
            <ProgramBundleUpsellItem key={program.id} program={program} />
          ))}
        </>
      )}
    </BundleUpsellContainer>
  )
}

export default ProgramBundleUpsell
export { BUNDLE_DISCOUNT_LABEL }
