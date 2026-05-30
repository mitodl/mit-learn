"use client"
import React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Breadcrumbs,
  Container,
  Skeleton,
  styled,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "ol-components"
import { contractQueries } from "api/mitxonline-hooks/contracts"
import * as urls from "@/common/urls"

type EnrollmentCodeRow = {
  id?: number | string
  code?: string
  is_redeemed?: boolean
  redeemed_by?: string | null
  redeemed_on?: string | null
}

type ContractAdminPageProps = {
  orgId: number
  contractId: number
}

const PageRoot = styled(Container)(({ theme }) => ({
  paddingTop: theme.spacing(3),
  paddingBottom: theme.spacing(6),
}))

const TableWrapper = styled("div")(({ theme }) => ({
  marginTop: theme.spacing(3),
  border: `1px solid ${theme.custom.colors.lightGray2}`,
  borderRadius: "4px",
  overflow: "hidden",
}))

const formatDate = (value?: string | null) => {
  if (!value) {
    return "—"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleDateString()
}

const formatBoolean = (value?: boolean) => (value ? "Yes" : "No")

const ContractAdminPage: React.FC<ContractAdminPageProps> = ({
  orgId,
  contractId,
}) => {
  const codesQuery = useQuery(
    contractQueries.managerContractCodes({
      id: contractId,
      parent_lookup_organization: orgId,
    }),
  )

  return (
    <PageRoot>
      <Breadcrumbs
        variant="light"
        ancestors={[{ href: urls.HOME, label: "Home" }]}
        current="Contract Admin"
      />
      <Typography variant="h3" component="h1">
        {codesQuery.isLoading
          ? "Loading contract..."
          : "Contract Admin"}
      </Typography>
      {/* {codesData?.description ? (
        <Typography variant="body1">{codesData.description}</Typography>
      ) : null} */}

      <Typography variant="h5" component="h2" sx={{ mt: 4 }}>
        Enrollment Codes
      </Typography>

      {codesQuery.isLoading ? (
        <Skeleton width="100%" height="200px" />
      ) : codesQuery.isError ? (
        <Typography variant="body1">
          Unable to load enrollment codes for this contract.
        </Typography>
      ) : codesQuery.data && (codesQuery.data as unknown as EnrollmentCodeRow[]).length === 0 ? (
        <Typography variant="body1">
          No enrollment codes found for this contract.
        </Typography>
      ) : (
        <TableWrapper>
          <TableContainer>
            <Table aria-label="Enrollment codes">
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Redeemed</TableCell>
                  <TableCell>Redeemed By</TableCell>
                  <TableCell>Redeemed On</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {codesQuery.data && (codesQuery.data as unknown as EnrollmentCodeRow[]).map((code, index) => (
                  <TableRow key={code.id ?? index}>
                    <TableCell>{code.code ?? "—"}</TableCell>
                    <TableCell>{formatBoolean(code.is_redeemed)}</TableCell>
                    <TableCell>{code.redeemed_by ?? "—"}</TableCell>
                    <TableCell>{formatDate(code.redeemed_on)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TableWrapper>
      )}
    </PageRoot>
  )
}

export default ContractAdminPage
export type { ContractAdminPageProps }
