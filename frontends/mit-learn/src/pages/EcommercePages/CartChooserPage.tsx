import React from "react"
import { useNavigate } from "react-router"
import { Breadcrumbs, Container, Typography, styled } from "ol-components"
import EcommerceFeature from "@/page-components/EcommerceFeature/EcommerceFeature"
import MetaTags from "@/page-components/MetaTags/MetaTags"
import * as urls from "@/common/urls"
import { usePaymentsBasketList } from "ue-api/hooks/payments"
import { useMetaIntegratedSystemsList } from "ue-api/hooks/meta"

const SelectorContainer = styled.div(() => ({
  width: "33%",
  marginTop: "2rem",
  marginLeft: "auto",
  marginRight: "auto",
  padding: "20px",
  border: "1px solid black",
  label: {
    paddingRight: "1rem",
  }
}))

const CartChooserPage: React.FC = () => {
    const { data: baskets, isFetched: areBasketsFetched } = usePaymentsBasketList()
    const { data: systems, isFetched: areSystemsFetched } = useMetaIntegratedSystemsList()
    const navigate = useNavigate()

    const setSelectedBasket = (basketId: number) => {
        const basket = baskets?.results.find((b) => b.id === basketId)

        console.log("basket", basket)

        if (basket && basket.integrated_system.slug) {
            navigate(urls.ECOMMERCE_CART.replace(":system", basket.integrated_system.slug))
        }
    }

    const getSystemName = (systemId: number) => {
        const system = systems?.results.find((sys) => sys.id === systemId)
        return system?.name || `System ${systemId}`
    }

    return areBasketsFetched && areSystemsFetched ? <EcommerceFeature>
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
                <label htmlFor="basket">Choose a system:</label>
                <select name="basket" id="basket" onChange={(ev) => setSelectedBasket(parseInt(ev.target.value))}>
                    <option aria-labelledby="basket" />
                {baskets?.results.map((basket) => <option key={`ue-basket-${basket.id}`} value={basket.id}>{getSystemName(basket.integrated_system.id)} {basket.basket_items.length} items</option>)}
                </select>
            </SelectorContainer>
        </Container>
    </EcommerceFeature> : null
}

export default CartChooserPage
