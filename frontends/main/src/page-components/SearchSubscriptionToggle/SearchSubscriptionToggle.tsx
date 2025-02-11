import React, { useState, useMemo } from "react"
import { getSearchParamMap } from "@/common/utils"
import {
  useSearchSubscriptionCreate,
  useSearchSubscriptionList,
} from "api/hooks/searchSubscription"
import { styled } from "ol-components"
import { Button } from "@mitodl/smoot-design"
import type { ButtonProps } from "@mitodl/smoot-design"

import { RiMailLine } from "@remixicon/react"
import { useUserMe } from "api/hooks/user"
import { SourceTypeEnum } from "api"
import { FollowPopover } from "../FollowPopover/FollowPopover"

const StyledButton = styled(Button)({
  minWidth: "130px",
})

const SuccessButton = styled((props: Omit<ButtonProps, "variant">) => (
  <StyledButton {...props} variant="primary" />
))(({ theme }) => ({
  backgroundColor: theme.custom.colors.darkGreen,
  color: theme.custom.colors.white,
  border: "none",
  /* Shadow/04dp */
  boxShadow:
    "0px 2px 4px 0px rgba(37, 38, 43, 0.10), 0px 3px 8px 0px rgba(37, 38, 43, 0.12)",
  ":hover:not(:disabled)": {
    backgroundColor: theme.custom.colors.darkGreen,
    boxShadow: "none",
  },
  ":disabled": {
    backgroundColor: theme.custom.colors.silverGray,
    boxShadow: "none",
  },
}))

type SearchSubscriptionToggleProps = {
  itemName: string
  searchParams: URLSearchParams
  sourceType: SourceTypeEnum
}

const SearchSubscriptionToggle: React.FC<SearchSubscriptionToggleProps> = ({
  itemName,
  searchParams,
  sourceType,
}) => {
  const [buttonEl, setButtonEl] = useState<null | HTMLElement>(null)

  const subscribeParams: Record<string, string[] | string> = useMemo(() => {
    return { source_type: sourceType, ...getSearchParamMap(searchParams) }
  }, [searchParams, sourceType])

  const { data: user } = useUserMe()

  const subscriptionCreate = useSearchSubscriptionCreate()
  const subscriptionList = useSearchSubscriptionList(subscribeParams, {
    enabled: !!user?.is_authenticated,
  })

  const subscriptionId = subscriptionList.data?.[0]?.id
  const isSubscribed = !!subscriptionId

  const onFollowClick = async (event: React.MouseEvent<HTMLElement>) => {
    setButtonEl(event.currentTarget)
  }

  if (user?.is_authenticated && subscriptionList.isLoading) return null
  if (!user) return null

  if (isSubscribed) {
    return (
      <>
        <SuccessButton onClick={onFollowClick} startIcon={<RiMailLine />}>
          Following
        </SuccessButton>
        <FollowPopover
          searchParams={searchParams}
          itemName={itemName}
          sourceType={sourceType}
          anchorEl={buttonEl}
          onClose={() => setButtonEl(null)}
        />
      </>
    )
  }

  return (
    <>
      <StyledButton
        variant="primary"
        disabled={subscriptionCreate.isPending}
        startIcon={<RiMailLine />}
        onClick={onFollowClick}
      >
        Follow
      </StyledButton>
      <FollowPopover
        searchParams={searchParams}
        itemName={itemName}
        sourceType={sourceType}
        anchorEl={buttonEl}
        onClose={() => setButtonEl(null)}
      />
    </>
  )
}

export { SearchSubscriptionToggle }
export type { SearchSubscriptionToggleProps }
