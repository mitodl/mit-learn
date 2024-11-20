import React from "react"
import { useParams } from "react-router"
import { Breadcrumbs, Container, Typography, styled } from "ol-components"
import EcommerceFeature from "@/page-components/EcommerceFeature/EcommerceFeature"
import MetaTags from "@/page-components/MetaTags/MetaTags"
import * as urls from "@/common/urls"
import { usePaymentsBasketList } from "ue-api/hooks/payments"
import { useMetaIntegratedSystemsList } from "ue-api/hooks/meta"
import type { BasketItemWithProduct } from "ue-api/generated/v0/api"

type CartPageInteriorProps = {
  systemId: number
}

type CartItemCardProps = {
  item: BasketItemWithProduct
}

const CartContainer = styled(Container)(({ theme }) => ({
  display: "flex",
  [theme.breakpoints.down("md")]: {
    padding: "24px 16px",
    gap: "24px",
  },
}))

const CartItemsContainer = styled(Container)(() => ({
  width: "66%",
}))

const OrderSummaryContainer = styled(Container)(() => ({
  width: "33%",
}))

const ItemImg = styled.img`
  padding: 32px;
  padding-right: 0;
  width: 200px;
  height: auto;
`

const ItemDetails = styled.div`
  width: auto;
  flex-grow: 1;
  padding: 32px;
`

const CartItemCard: React.FC<CartItemCardProps> = ({ item }) => <>
  <ItemImg alt="placeholder" src="http://placecats.com/200/100" />
  <ItemDetails>
    <p>{ item.product.sku }</p>
    <h3>{ item.product.name }</h3>

    <p>{item.product.description}</p>
  </ItemDetails>
</>

const StyledItemCard = styled(CartItemCard)(() => ({
  display: "flex",
  ["img"]: {
    padding: "32px",
    paddingRight: "0",
    width: "200px",
  }
}))

const CartPageInterior: React.FC<CartPageInteriorProps> = ({ systemId }) => {
  const { data: baskets, isFetched } = usePaymentsBasketList()
  const [ basket, setBasket ] = React.useState<BasketItemWithProduct|null>(null)

  React.useEffect(() => {
    if (isFetched && baskets?.results) {
      const foundBasket = baskets.results.find((b) => b.integrated_system.id === systemId)
      setBasket(foundBasket)
    }
  }, [isFetched, baskets, systemId])

  return basket ? <Container>
      {basket?.basket_items && basket.basket_items.length > 0 ? <>
        <Typography component="h2">
          You are about to purchase the following:
        </Typography>

        <CartContainer>
          <CartItemsContainer>
            {basket.basket_items.map((item: BasketItemWithProduct) => <StyledItemCard key={`basket-item-${item.id}`} item={item} />)}
          </CartItemsContainer>

          <OrderSummaryContainer>
            <h2>Here's where the order summary should go.</h2>
          </OrderSummaryContainer>
        </CartContainer>

        </>: <Typography component="h2">No items in the cart.</Typography>}
  </Container> : <div>Loading...</div>
}

const CartPage: React.FC = () => {
  const { system } = useParams()
  const { data: systems, isFetched: areSystemsFetched } = useMetaIntegratedSystemsList()

  const getSystemId = () => {
    const foundSystem = systems?.results.find((sys) => sys.slug === system)
    return foundSystem?.id || -1
  }

  const getSystemName = () => {
    const foundSystem = systems?.results.find((sys) => sys.slug === system)
    return foundSystem?.name || ""
  }

  return areSystemsFetched && getSystemId() >= 0 ? (
    <EcommerceFeature>
      <MetaTags title="Shopping Cart" />
      <Breadcrumbs
        variant="light"
        ancestors={[{ href: urls.HOME, label: "Home" }]}
        current="Shopping Cart"
      />

      <Typography component="h1" variant="h3">
        {getSystemName()} Shopping Cart
      </Typography>

      <CartPageInterior systemId={getSystemId()} />
    </EcommerceFeature>
  ) : null
}

export default CartPage
