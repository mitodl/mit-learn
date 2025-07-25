"use client"
import React, { useCallback } from "react"
import {
  LoadingSpinner,
  styled,
  Typography,
  PlainList,
  Card,
  theme,
  TypographyProps,
} from "ol-components"
import { Button } from "@mitodl/smoot-design"
import { RiListCheck3 } from "@remixicon/react"
import { useUserListList } from "api/hooks/userLists"
import { manageListDialogs } from "@/page-components/ManageListDialogs/ManageListDialogs"
import { userListView } from "@/common/urls"
import UserListCardCondensed from "@/page-components/UserListCard/UserListCardCondensed"

const Header = styled(Typography)<Pick<TypographyProps, "component">>({
  marginBottom: "16px",
})

const NewListButton = styled(Button)(({ theme }) => ({
  marginTop: "24px",
  width: "200px",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}))

const EmptyListCard = styled(Card)`
  margin-top: 16px;
`

const EmptyList = styled.div`
  display: flex;
  padding: 32px;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  text-align: center;
`

const IconContainer = styled.div`
  display: inline-block;
  margin: 0 auto -16px;
  padding: 8px;
  height: 48px;
  border-radius: 4px;
  color: ${theme.custom.colors.silverGrayDark};
  background: ${theme.custom.colors.lightGray1};

  svg {
    width: 32px;
    height: 32px;
  }
`

type UserListListingComponentProps = {
  title?: string
}

const UserListListingComponent: React.FC<UserListListingComponentProps> = (
  props,
) => {
  const { title } = props
  const { data, isLoading } = useUserListList()
  const handleCreate = useCallback(() => {
    manageListDialogs.upsertUserList()
  }, [])

  return (
    <>
      <Header component="h1" variant="h3">
        {title}
      </Header>
      <section>
        <LoadingSpinner loading={isLoading} />
        {!data?.results.length && !isLoading ? (
          <EmptyListCard>
            <Card.Content>
              <EmptyList>
                <IconContainer>
                  <RiListCheck3 />
                </IconContainer>
                <Typography variant="body2">
                  Create lists to save your courses and materials.
                </Typography>
                <Button variant="primary" size="large" onClick={handleCreate}>
                  Create new list
                </Button>
              </EmptyList>
            </Card.Content>
          </EmptyListCard>
        ) : null}
        {data ? (
          <PlainList itemSpacing={3}>
            {data.results?.map((list) => {
              return (
                <li
                  key={list.id}
                  data-testid={`user-list-card-condensed-${list.id}`}
                >
                  <UserListCardCondensed
                    href={userListView(list.id)}
                    userList={list}
                  />
                </li>
              )
            })}
          </PlainList>
        ) : null}
        {data?.results.length && !isLoading ? (
          <NewListButton variant="primary" onClick={handleCreate}>
            Create new list
          </NewListButton>
        ) : null}
      </section>
    </>
  )
}

export default UserListListingComponent
