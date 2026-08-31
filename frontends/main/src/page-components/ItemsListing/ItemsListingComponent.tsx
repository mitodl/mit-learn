import React from "react"
import { Grid2 as Grid, Typography, styled } from "ol-components"
import { Button, ButtonLink } from "@mitodl/smoot-design"
import { RiArrowLeftLine, RiArrowUpDownLine } from "@remixicon/react"
import { useToggle, pluralize } from "ol-utilities"
import ItemsListing from "./ItemsListing"
import type { LearningResourceListItem } from "./ItemsListing"
import { MY_LISTS } from "@/common/urls"

type OnEdit = () => void
type ListData = {
  title: string
  description?: string | null
  item_count: number
}

type ItemsListingComponentProps = {
  listType: string
  list?: ListData
  items: LearningResourceListItem[]
  showSort: boolean
  canEdit: boolean
  isLoading: boolean
  isFetching: boolean
  handleEdit: OnEdit
  condensed?: boolean
}

const HeaderText = styled.h1(({ theme }) => ({
  margin: 0,
  ...theme.typography.h3,
  [theme.breakpoints.down("sm")]: {
    marginBottom: "24px",
    ...theme.typography.h5,
  },
}))

const DescriptionText = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  ...theme.typography.body1,
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}))

const HeaderGrid = styled(Grid)(({ theme }) => ({
  gap: "24px",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

const EditButton = styled(Button)(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

const ReorderGrid = styled(Grid)(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}))

const CountText = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
  ...theme.typography.buttonSmall,
}))

const ItemsListingComponent: React.FC<ItemsListingComponentProps> = ({
  listType,
  list,
  items,
  showSort,
  canEdit,
  isLoading,
  isFetching,
  handleEdit,
  condensed = false,
}) => {
  const [isSorting, toggleIsSorting] = useToggle(false)

  const count = list?.item_count

  return (
    <Grid container columnSpacing={6}>
      <Grid size={12}>
        <Grid container>
          <Grid
            container
            size={12}
            alignItems="center"
            justifyContent="space-between"
            marginBottom="24px"
          >
            <Grid>
              <ButtonLink
                href={MY_LISTS}
                variant="tertiary"
                startIcon={<RiArrowLeftLine />}
              >
                My Lists
              </ButtonLink>
            </Grid>
          </Grid>
          <Grid
            container
            size={12}
            alignItems="center"
            justifyContent="space-between"
            marginBottom="24px"
          >
            <HeaderGrid>
              <HeaderText>{list?.title}</HeaderText>
              {list?.description && (
                <DescriptionText>{list.description}</DescriptionText>
              )}
            </HeaderGrid>
            <HeaderGrid alignSelf="flex-start">
              {canEdit ? (
                <EditButton variant="primary" onClick={handleEdit}>
                  Edit List
                </EditButton>
              ) : null}
            </HeaderGrid>
          </Grid>
          <ReorderGrid
            container
            size={12}
            alignItems="center"
            justifyContent="space-between"
          >
            <Grid>
              {showSort && !!items.length && (
                <Button
                  variant="text"
                  disabled={count === 0}
                  startIcon={isSorting ? undefined : <RiArrowUpDownLine />}
                  onClick={toggleIsSorting.toggle}
                >
                  {isSorting ? "Done ordering" : "Reorder"}
                </Button>
              )}
            </Grid>
            <Grid>
              {count !== undefined && count > 0 ? (
                <CountText>{`${count} ${pluralize("item", count)}`}</CountText>
              ) : null}
            </Grid>
          </ReorderGrid>
        </Grid>
        <ItemsListing
          listType={listType}
          items={items}
          isLoading={isLoading}
          isRefetching={isFetching}
          sortable={isSorting}
          emptyMessage="There are no items in this list yet."
          condensed={condensed}
        />
      </Grid>
    </Grid>
  )
}

export default ItemsListingComponent
export type { ItemsListingComponentProps }
