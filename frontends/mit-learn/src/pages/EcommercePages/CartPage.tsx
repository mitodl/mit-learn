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

const EcommercePageTemplate = styled.div`
  margin: 40px 100px;
`

const CartContainer = styled.div(() => ({
  display: "flex",
  width: "100%",
  margin: "16px 0",
  padding: "0 !important",
}))

const CartSectionContainer = styled.div`
  display: flex;
  background-color: #FFF;
  border-radius: 8px;
  border: 1px solid #DDE1E6;
  padding: 32px;
  gap: 32px;
  box-shadow: 0px 2px 4px 0px rgba(37, 38, 43, 0.10), 0px 3px 8px 0px rgba(37, 38, 43, 0.12);
  flex-direction: row;
`

const CartItemsContainer = styled(CartSectionContainer)(() => ({
  width: "auto",
  flexGrow: "1",
  marginRight: "23px",
}))

const ItemImg = styled.img`
  padding-right: 0;
  width: 200px;
  max-height: 110px;
  height: auto;
`

const ItemDetails = styled.div`
  width: auto;
  flex-grow: 1;
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
  "flex-direction": "row",
  padding: "32px",  
  ["img"]: {
    width: "200px",
    maxHeight: "110px",
  }
}))

const OrderSummaryContainer = styled(CartSectionContainer)`
  width: 424px;
  margin-left: 23px;
  display: flex;
  flex-direction: column;
`

const OrderSummaryHeader = styled.h4(() => ({
  width: "100%",
  flexGrow: "1",
  fontSize: "24px",
  margin: "0",
}))

const OrderSummaryItem = styled.div`
  width: 100%;
  display: flex;
  flex-direction: row;
  align-content: start;
`

const OrderSummaryItemSku = styled.p`
  width: auto;
  flex-grow: 1;
`

const OrderSummaryItemPrice = styled.p`
  width: auto;
  margin-right: 16px;
  text-align: right;
`


const CartPageInterior: React.FC<CartPageInteriorProps> = ({ systemId }) => {
  const { data: baskets, isFetched } = usePaymentsBasketList()
  const [ basket, setBasket ] = React.useState<BasketItemWithProduct|null>(null)

  React.useEffect(() => {
    if (isFetched && baskets?.results) {
      const foundBasket = baskets.results.find((b) => b.integrated_system.id === systemId)
      setBasket(foundBasket)
    }
  }, [isFetched, baskets, systemId])

  return basket ? <>
      {basket?.basket_items && basket.basket_items.length > 0 ? <>
        <Typography component="h2">
          You are about to purchase the following:
        </Typography>

        <CartContainer>
          <CartItemsContainer>
            {basket.basket_items.map((item: BasketItemWithProduct) => <StyledItemCard key={`basket-item-${item.id}`} item={item} />)}
          </CartItemsContainer>

          <OrderSummaryContainer>
            <OrderSummaryHeader>Order Summary</OrderSummaryHeader>

            {basket.basket_items.map((item: BasketItemWithProduct) => <OrderSummaryItem key={`order-summary-item-${item.id}`}>
              <OrderSummaryItemSku key={`order-summary-sku-${item.id}`}>
                {item.product.description}<br />
                {item.product.sku}
              </OrderSummaryItemSku> 
              <OrderSummaryItemPrice key={`order-summary-price-${item.id}`}>
                {item.discounted_price.toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </OrderSummaryItemPrice> 
            </OrderSummaryItem>)}
          </OrderSummaryContainer>
        </CartContainer>

        </>: <Typography component="h2">No items in the cart.</Typography>}
  </> : <div>Loading...</div>
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
      <EcommercePageTemplate>
        <MetaTags title="Shopping Cart" />
        <Breadcrumbs
          variant="light"
          ancestors={[{ href: urls.HOME, label: "Home" }]}
          current={`${getSystemName()} Shopping Cart`}
        />

        <CartPageInterior systemId={getSystemId()} />
      </EcommercePageTemplate>
    </EcommerceFeature>
  ) : null
}

export default CartPage
