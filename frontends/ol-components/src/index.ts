"use client"
/// <reference types="./types/theme.d.ts" />
/// <reference types="./types/typography.d.ts" />

/**
 * Re-exports from MUI.
 *
 * This might expose more props than we want to expose. On the other hand, it
 * means that:
 *  - we get MUI's docstrings
 *  - we don't need to implement ref-forwarding, which is important for some
 *    functionality.
 */

export { default as AppBar } from "@mui/material/AppBar"
export type { AppBarProps } from "@mui/material/AppBar"

export { Banner, BannerBackground } from "./components/Banner/Banner"
export type {
  BannerProps,
  BannerBackgroundProps,
} from "./components/Banner/Banner"

export { ListCard, ListCardActionButton } from "./components/Card/ListCard"

export { default as Chip } from "@mui/material/Chip"
export type { ChipProps } from "@mui/material/Chip"

export { default as ClickAwayListener } from "@mui/material/ClickAwayListener"
export type { ClickAwayListenerProps } from "@mui/material/ClickAwayListener"

export { default as Container } from "@mui/material/Container"
export type { ContainerProps } from "@mui/material/Container"

export { default as Divider } from "@mui/material/Divider"
export type { DividerProps } from "@mui/material/Divider"

export { default as Drawer } from "@mui/material/Drawer"
export type { DrawerProps } from "@mui/material/Drawer"

export { default as Grid } from "@mui/material/Grid"
export type { GridProps } from "@mui/material/Grid"
export { default as Grid2 } from "@mui/material/Grid2"
export type { Grid2Props } from "@mui/material/Grid2"

export { default as List } from "@mui/material/List"
export type { ListProps } from "@mui/material/List"
export { default as ListItem } from "@mui/material/ListItem"
export type { ListItemProps } from "@mui/material/ListItem"
export { ListItemLink } from "./components/Lists/ListItemLink"
export type { ListItemLinkProps } from "./components/Lists/ListItemLink"
export { default as ListItemText } from "@mui/material/ListItemText"
export type { ListItemTextProps } from "@mui/material/ListItemText"

export { default as Skeleton } from "@mui/material/Skeleton"
export type { SkeletonProps } from "@mui/material/Skeleton"

export { default as Stack } from "@mui/material/Stack"
export type { StackProps } from "@mui/material/Stack"

export { default as Tab } from "@mui/material/Tab"
export type { TabProps } from "@mui/material/Tab"

export { default as TabList } from "@mui/lab/TabList"
export type { TabListProps } from "@mui/lab/TabList"

export { default as TabContext } from "@mui/lab/TabContext"
export type { TabContextProps } from "@mui/lab/TabContext"
export { default as TabPanel } from "@mui/lab/TabPanel"
export type { TabPanelProps } from "@mui/lab/TabPanel"

export { default as Toolbar } from "@mui/material/Toolbar"
export type { ToolbarProps } from "@mui/material/Toolbar"

// Mui Form Inputs
export { default as Autocomplete } from "@mui/material/Autocomplete"
export type { AutocompleteProps } from "@mui/material/Autocomplete"
export { default as ToggleButton } from "@mui/material/ToggleButton"
export { default as ToggleButtonGroup } from "@mui/material/ToggleButtonGroup"

export { default as Pagination } from "@mui/material/Pagination"
export type { PaginationProps } from "@mui/material/Pagination"
export { default as Typography } from "@mui/material/Typography"
export type { TypographyProps } from "@mui/material/Typography"
export { default as PaginationItem } from "@mui/material/PaginationItem"

export { default as Collapse } from "@mui/material/Collapse"

export * from "./components/MenuItem/MenuItem"

export { default as Stepper } from "@mui/material/Stepper"
export { default as Step } from "@mui/material/Step"
export { default as StepLabel } from "@mui/material/StepLabel"
export type { StepIconProps } from "@mui/material/StepIcon"

export { default as FormGroup } from "@mui/material/FormGroup"
export { default as Slider } from "@mui/material/Slider"

export * from "./components/BannerPage/BannerPage"
export * from "./components/Breadcrumbs/Breadcrumbs"
export * from "./components/Card/Card"
export * from "./components/Card/ListCardCondensed"
export * from "./components/Carousel/Carousel"
export { onReInitSlickA11y } from "./components/Carousel/util"

export * from "./components/Chips/ChipLink"
export * from "./components/ChoiceBox/ChoiceBox"
export * from "./components/ChoiceBox/ChoiceBoxField"
export * from "./components/Dialog/Dialog"
export * from "./components/EmbedlyCard/EmbedlyCard"
export * from "./components/FormDialog/FormDialog"
export * from "./components/LearningResourceCard/LearningResourceCard"
export { LearningResourceListCard } from "./components/LearningResourceCard/LearningResourceListCard"
export type { LearningResourceListCardProps } from "./components/LearningResourceCard/LearningResourceListCard"
export * from "./components/LearningResourceCard/LearningResourceListCardCondensed"
export * from "./components/LoadingSpinner/LoadingSpinner"
export * from "./components/Logo/Logo"
export * from "./components/NavDrawer/NavDrawer"
export * from "./components/PlainList/PlainList"
export * from "./components/Popover/Popover"
export * from "./components/RoutedDrawer/RoutedDrawer"
export * from "./components/SimpleMenu/SimpleMenu"
export * from "./components/SortableList/SortableList"
export * from "./components/ThemeProvider/ThemeProvider"
export * from "./components/TruncateText/TruncateText"

export * from "./constants/imgConfigs"

export { SearchInput } from "./components/SearchInput/SearchInput"
export type {
  SearchInputProps,
  SearchSubmissionEvent,
} from "./components/SearchInput/SearchInput"

export {
  SimpleSelect,
  SimpleSelectField,
} from "./components/SimpleSelect/SimpleSelect"
export type {
  SimpleSelectProps,
  SimpleSelectFieldProps,
  SimpleSelectOption,
} from "./components/SimpleSelect/SimpleSelect"

export { SelectField } from "./components/SelectField/SelectField"
export type {
  SelectChangeEvent,
  SelectProps,
  SelectFieldProps,
} from "./components/SelectField/SelectField"

export { Link, linkStyles } from "./components/Link/Link"
export type { LinkProps } from "./components/Link/Link"

export { pxToRem } from "./components/ThemeProvider/typography"
export { MITLearnGlobalStyles } from "./components/ThemeProvider/MITLearnGlobalStyles"

export { default as styled } from "@emotion/styled"
export { css, Global } from "@emotion/react"

export { AppRouterCacheProvider as NextJsAppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter"

/**
 * @deprecated Please use component from @mitodl/smoot-design instead
 */
const Migrated = () => {
  throw new Error("Please use component from @mitodl/smoot-design instead")
}
export {
  Migrated as ActionButton,
  Migrated as ActionButtonLink,
  Migrated as Button,
  Migrated as ButtonLink,
}
