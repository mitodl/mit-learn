"use client"
import React from "react"
import { Typography } from "ol-components/ThemeProvider/typography"
import Container from "@mui/material/Container"
import { Breadcrumbs } from "ol-components/Breadcrumbs/Breadcrumbs"
import EcommerceFeature from "@/page-components/EcommerceFeature/EcommerceFeature"
import * as urls from "@/common/urls"

const CartPage: React.FC = () => {
  return (
    <EcommerceFeature>
      <Container>
        <Breadcrumbs
          variant="light"
          ancestors={[{ href: urls.HOME, label: "Home" }]}
          current="Shopping Cart"
        />

        <Typography component="h1" variant="h3">
          Shopping Cart
        </Typography>

        <Typography>
          The shopping cart layout should go here, if you're allowed to see
          this.
        </Typography>
      </Container>
    </EcommerceFeature>
  )
}

export default CartPage
