import React from "react"
import { Container, Card, CardContent, CardActions } from "ol-design"
import { ButtonLink } from "ol-design"

import { HOME } from "../urls"
import { MetaTags } from "ol-util"

const NotFoundPage: React.FC = () => {
  return (
    <Container maxWidth="sm">
      <Card sx={{ marginTop: "1rem" }}>
        <MetaTags>
          <meta name="robots" content="noindex,noarchive" />
        </MetaTags>
        <CardContent>
          <h1>404 Not Found Error</h1>
          Resource Not Found
        </CardContent>
        <CardActions>
          <ButtonLink variant="outlined" to={HOME}>
            Home
          </ButtonLink>
        </CardActions>
      </Card>
    </Container>
  )
}

export default NotFoundPage
