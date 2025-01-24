import React from "react"
import { styled } from "@pigment-css/react"
import { Container, BannerPage } from "ol-components"
import PrivateTitle from "@/components/PrivateTitle/PrivateTitle"
import ItemsListingComponent from "@/page-components/ItemsListing/ItemsListingComponent"
import type { ItemsListingComponentProps } from "@/page-components/ItemsListing/ItemsListingComponent"

const StyledContainer = styled(Container)({
  paddingTop: "24px",
  marginBottom: "80px",
})

const ListDetailsPage: React.FC<ItemsListingComponentProps> = ({
  listType,
  list,
  items,
  showSort,
  canEdit,
  isLoading,
  isFetching,
  handleEdit,
}) => {
  return (
    <BannerPage
      src="/images/backgrounds/course_search_banner.png"
      className="learningpaths-page"
    >
      <PrivateTitle title={list?.title || ""} />
      <StyledContainer maxWidth="md">
        <ItemsListingComponent
          listType={listType}
          list={list}
          items={items}
          showSort={showSort}
          canEdit={canEdit}
          isLoading={isLoading}
          isFetching={isFetching}
          handleEdit={handleEdit}
        />
      </StyledContainer>
    </BannerPage>
  )
}

export default ListDetailsPage
