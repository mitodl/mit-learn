import React, { useState, useMemo } from "react"
import { getSearchParamMap } from "@/common/client-utils"
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
  /**
   * The glyph beside the label. Defaults to the envelope, which is what every
   * caller got before this existed -- the topic page's design asks for a
   * different one, and this is the only thing that differs.
   */
  icon?: React.ReactNode
}

const SearchSubscriptionToggle: React.FC<SearchSubscriptionToggleProps> = ({
  itemName,
  searchParams,
  sourceType,
  icon = <RiMailLine />,
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
        <SuccessButton onClick={onFollowClick} startIcon={icon}>
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
        startIcon={icon}
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
