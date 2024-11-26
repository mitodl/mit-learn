import React from "react"
import { useNavigate } from "react-router"
import { Breadcrumbs, Container, Typography, styled } from "ol-components"
import EcommerceFeature from "@/page-components/EcommerceFeature/EcommerceFeature"
import MetaTags from "@/page-components/MetaTags/MetaTags"
import * as urls from "@/common/urls"
import { usePaymentsBasketList } from "ue-api/hooks/payments"
import {
  useMetaIntegratedSystemsList,
  useMetaProductsList,
} from "ue-api/hooks/meta"

const SelectorContainer = styled.div(() => ({
  width: "33%",
  marginTop: "2rem",
  marginLeft: "auto",
  marginRight: "auto",
  padding: "20px",
  border: "1px solid black",
  label: {
    paddingRight: "1rem",
  },
  div: {
    marginBottom: "2rem",
  },
}))

type ProductChooserProps = {
  systemId: string
}

const ProductChooser: React.FC<ProductChooserProps> = ({ systemId }) => {
  const { data: products, isFetched: areProductsFetched } =
    useMetaProductsList(systemId)
  return areProductsFetched ? (
    <>
      <div>
        <label htmlFor="product">Choose a product:</label>
        <select name="product" id="product">
          <option aria-labelledby="product" />
          {products?.results.map((product) => (
            <option key={`ue-product-${product.id}`} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </div>
    </>
  ) : (
    <>Loading products...</>
  )
}

const CartChooserPage: React.FC = () => {
  const { data: baskets, isFetched: areBasketsFetched } =
    usePaymentsBasketList()
  const { data: systems, isFetched: areSystemsFetched } =
    useMetaIntegratedSystemsList()
  const [selectedSystem, setSelectedSystem] = React.useState<string | null>(
    null,
  )
  const navigate = useNavigate()

  const setSelectedBasket = (basketId: number) => {
    const basket = baskets?.results.find((b) => b.id === basketId)

    console.log("basket", basket)

    if (basket && basket.integrated_system.slug) {
      navigate(
        urls.ECOMMERCE_CART.replace(":system", basket.integrated_system.slug),
      )
    }
  }

  const getSystemName = (systemId: number) => {
    const system = systems?.results.find((sys) => sys.id === systemId)
    return system?.name || `System ${systemId}`
  }

  return areBasketsFetched && areSystemsFetched ? (
    <EcommerceFeature>
      <Container>
        <MetaTags title="Shopping Cart" />
        <Breadcrumbs
          variant="light"
          ancestors={[{ href: urls.HOME, label: "Home" }]}
          current="Shopping Cart"
        />

        <Typography component="h1" variant="h3">
          Shopping Cart - Choose System
        </Typography>

        <SelectorContainer>
          <div>
            <label htmlFor="basket">Choose an existing system basket:</label>
            <select
              name="basket"
              id="basket"
              onChange={(ev) => setSelectedBasket(parseInt(ev.target.value))}
            >
              <option aria-labelledby="basket" />
              {baskets?.results.map((basket) => (
                <option key={`ue-basket-${basket.id}`} value={basket.id}>
                  {getSystemName(basket.integrated_system.id)}{" "}
                  {basket.basket_items.length} items
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="choose_system">
              Choose a system, then a product, to start a basket:
            </label>
            <select
              name="choose_system"
              id="choose_system"
              onChange={(ev) => setSelectedSystem(ev.target.value)}
            >
              <option aria-labelledby="choose_system" />
              {systems?.results.map((system) => (
                <option
                  key={`ue-system-${system.id}`}
                  value={system.slug || ""}
                >
                  {system.name}
                </option>
              ))}
            </select>
          </div>

          {selectedSystem ? <ProductChooser systemId={selectedSystem} /> : null}
        </SelectorContainer>
      </Container>
    </EcommerceFeature>
  ) : null
}

export default CartChooserPage
