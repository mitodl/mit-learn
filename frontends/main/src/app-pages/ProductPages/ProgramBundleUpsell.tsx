import React from "react"
import { styled } from "@mitodl/smoot-design"
import { programsQueries } from "api/mitxonline-hooks/programs"
import { Skeleton } from "ol-components"
import type {
  BaseProgram,
  V2ProgramDetail,
} from "@mitodl/mitxonline-api-axios/v2"
import { DisplayModeEnum } from "@mitodl/mitxonline-api-axios/v2"
import { parseReqTree } from "./util"
import { useQuery } from "@tanstack/react-query"
import { programPageView } from "@/common/urls"

const BundleUpsellContainer = styled.div(({ theme }) => ({
  boxShadow: "inset 0px 16px 24px 0px rgba(0, 40, 150, 0.05)",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
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

const SectionLabel = styled.span(({ theme }) => ({
  ...theme.typography.body2,
  display: "block",
  color: theme.custom.colors.silverGrayDark,
  textTransform: "uppercase",
  letterSpacing: "0.0875em",
}))

const BundleUpsellItem = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  borderLeft: `2px solid ${theme.custom.colors.red}`,
  paddingLeft: "12px",
  "& + &": {
    marginTop: "8px",
  },
}))

const BundleUpsellTitle = styled.span(({ theme }) => ({
  ...theme.typography.h5,
  fontSize: theme.typography.pxToRem(16),
  display: "block",
}))

const BundleDescription = styled.p(({ theme }) => ({
  ...theme.typography.body2,
  margin: 0,
  color: theme.custom.colors.darkGray1,
}))

const BundleDetailsLink = styled.a(({ theme }) => ({
  ...theme.typography.body2,
  color: theme.custom.colors.red,
  fontWeight: theme.typography.fontWeightMedium,
  textDecoration: "none",
  "&:hover": {
    textDecoration: "underline",
  },
}))

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
          <Skeleton width="80%" variant="text" />
        </BundleUpsellTitle>
        <BundleDescription>
          <Skeleton width="90%" variant="text" />
        </BundleDescription>
        <Skeleton width={140} variant="text" />
      </BundleUpsellItem>
    )
  }

  const parsedReqs = parseReqTree(program.req_tree)
  const totalRequired = parsedReqs.reduce(
    (sum, req) => sum + req.requiredCount,
    0,
  )

  return (
    <BundleUpsellItem data-testid="program-bundle-upsell-item">
      <BundleUpsellTitle>{program.title}</BundleUpsellTitle>
      <BundleDescription>
        Enroll in all {totalRequired} courses and save vs. individual pricing.
      </BundleDescription>
      <BundleDetailsLink
        href={programPageView({
          readable_id: program.readable_id,
          display_mode: program.display_mode,
        })}
      >
        View program details &gt;
      </BundleDetailsLink>
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
    (d): d is V2ProgramDetail =>
      /**
       * Exclude programs with display_mode="course" from bundle upsell.
       * These programs are presented as courses and should not appear as
       * bundleable programs.
       */
      d.display_mode !== DisplayModeEnum.Course && !!d.products[0]?.price,
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
      <SectionLabel>Part of a Program</SectionLabel>
      {isLoading
        ? programs.map((p) => <ProgramBundleUpsellItem key={p.id} loading />)
        : pricedPrograms.map((program) => (
            <ProgramBundleUpsellItem key={program.id} program={program} />
          ))}
    </BundleUpsellContainer>
  )
}

export default ProgramBundleUpsell
