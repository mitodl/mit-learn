import React, { useCallback, useMemo } from "react"
import {
  Button,
  SimpleMenu,
  ActionButton,
  Grid,
  LoadingSpinner,
  BannerPage,
  Container,
  styled,
  Typography,
  PlainList,
  LearningResourceListCard,
  useMuiBreakpointAtLeast,
} from "ol-components"
import type { SimpleMenuItem } from "ol-components"
import EditIcon from "@mui/icons-material/Edit"
import MoreVertIcon from "@mui/icons-material/MoreVert"
import DeleteIcon from "@mui/icons-material/Delete"

import { MetaTags } from "ol-utilities"
import type { LearningPathResource } from "api"
import { useLearningPathsList } from "api/hooks/learningResources"

import { GridColumn, GridContainer } from "@/components/GridLayout/GridLayout"

import { manageListDialogs } from "@/page-components/ManageListDialogs/ManageListDialogs"
import * as urls from "@/common/urls"
import { useUserMe } from "api/hooks/user"

const ListHeaderGrid = styled(Grid)`
  margin-top: 1rem;
  margin-bottom: 1rem;
`

const StyledActionButton = styled(ActionButton)<{ mobile: boolean }>`
  ${({ mobile }) =>
    mobile
      ? `
  width: 16px;
  height: 16px;`
      : ""}
`

type EditListMenuProps = {
  resource: LearningPathResource
  isMobile: boolean
}

const EditListMenu: React.FC<EditListMenuProps> = ({ resource, isMobile }) => {
  const items: SimpleMenuItem[] = useMemo(
    () => [
      {
        key: "edit",
        label: "Edit",
        icon: <EditIcon />,
        onClick: () => manageListDialogs.upsertLearningPath(resource),
      },
      {
        key: "delete",
        label: "Delete",
        icon: <DeleteIcon />,
        onClick: () => manageListDialogs.destroyLearningPath(resource),
      },
    ],
    [resource],
  )
  return (
    <SimpleMenu
      trigger={
        <StyledActionButton
          variant="secondary"
          edge="none"
          color="secondary"
          size="small"
          mobile={isMobile}
          aria-label={`Edit list ${resource.title}`}
        >
          <MoreVertIcon fontSize="inherit" />
        </StyledActionButton>
      }
      items={items}
    />
  )
}

const LearningPathListingPage: React.FC = () => {
  const isMobile = !useMuiBreakpointAtLeast("md")
  const listingQuery = useLearningPathsList()
  const { data: user } = useUserMe()

  const handleCreate = useCallback(() => {
    manageListDialogs.upsertLearningPath()
  }, [])

  const canEdit = !!user?.is_learning_path_editor

  return (
    <BannerPage
      src="/static/images/course_search_banner.png"
      alt=""
      className="learningpaths-page"
    >
      <MetaTags>
        <title>Learning Paths</title>
      </MetaTags>
      <Container maxWidth="md" style={{ paddingBottom: 100 }}>
        <GridContainer>
          <GridColumn variant="single-full">
            <ListHeaderGrid container justifyContent="space-between">
              <Grid item>
                <Typography variant="h3" component="h1">
                  Learning Paths
                </Typography>
              </Grid>
              <Grid
                item
                justifyContent="flex-end"
                alignItems="center"
                display="flex"
              >
                {canEdit ? (
                  <Button variant="primary" onClick={handleCreate}>
                    Create new list
                  </Button>
                ) : null}
              </Grid>
            </ListHeaderGrid>
            <section>
              <LoadingSpinner loading={listingQuery.isLoading} />
              {listingQuery.data && (
                <PlainList itemSpacing={3}>
                  {listingQuery.data.results?.map((resource) => {
                    return (
                      <li key={resource.id}>
                        <LearningResourceListCard
                          resource={resource}
                          href={urls.learningPathsView(resource.id)}
                          editMenu={
                            canEdit ? (
                              <EditListMenu
                                resource={resource}
                                isMobile={isMobile}
                              />
                            ) : null
                          }
                        />
                      </li>
                    )
                  })}
                </PlainList>
              )}
            </section>
          </GridColumn>
        </GridContainer>
      </Container>
    </BannerPage>
  )
}

export default LearningPathListingPage
