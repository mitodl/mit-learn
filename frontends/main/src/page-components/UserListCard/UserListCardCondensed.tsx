import React from "react"
import { UserList } from "api"
import { pluralize } from "ol-utilities"
import { RiListCheck3 } from "@remixicon/react"
import { ListCardCondensed, styled, theme, Typography } from "ol-components"
import Link from "next/link"

const StyledCard = styled(ListCardCondensed)({
  display: "flex",
  alignItems: "center",
  padding: "16px",
  margin: "0",
  gap: "16px",
  width: "100%",
})

const TextContainer = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "8px",
  flex: "1 0 0",
})

const ItemsText = styled(Typography)(({ theme }) => ({
  color: theme.custom.colors.silverGrayDark,
}))

const IconContainer = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  borderRadius: "4px",
  color: theme.custom.colors.silverGrayDark,
  background: theme.custom.colors.lightGray1,
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}))

type UserListCardCondensedProps = {
  userList: UserList
  href: string
  className?: string
}

const UserListCardCondensed = ({
  userList,
  href,
  className,
}: UserListCardCondensedProps) => {
  return (
    <StyledCard forwardClicksToLink className={className}>
      <ListCardCondensed.Content>
        <TextContainer>
          <Link href={href} data-card-link>
            <Typography
              variant="subtitle1"
              color={theme.custom.colors.darkGray2}
            >
              {userList.title}
            </Typography>
          </Link>
          <ItemsText variant="body3">
            {userList.item_count} {pluralize("item", userList.item_count)}
          </ItemsText>
        </TextContainer>
        <IconContainer>
          <RiListCheck3 size="48" />
        </IconContainer>
      </ListCardCondensed.Content>
    </StyledCard>
  )
}

export default UserListCardCondensed
export type { UserListCardCondensedProps }
