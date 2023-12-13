import React from "react"
import { GridColumn, GridContainer } from "../../components/layout"
import { Container, BannerPage } from "ol-design"
import { MetaTags } from "ol-util"

type ArticleUpsertPageProps = {
  children: React.ReactNode
  title: string
}

const ArticleUpsertPage: React.FC<ArticleUpsertPageProps> = ({
  children,
  title,
}) => {
  return (
    <BannerPage
      src="/static/images/course_search_banner.png"
      alt=""
      className="articles-editing-page"
    >
      <MetaTags>
        <title>{title}</title>
      </MetaTags>
      <Container maxWidth="sm">
        <GridContainer>
          <GridColumn variant="single-full">{children}</GridColumn>
        </GridContainer>
      </Container>
    </BannerPage>
  )
}

export default ArticleUpsertPage
