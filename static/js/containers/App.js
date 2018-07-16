/* global SETTINGS: false */
// @flow
import React from "react"
import { Route, Redirect } from "react-router-dom"
import { connect } from "react-redux"
import { MetaTags } from "react-meta-tags"

import HomePage from "./HomePage"
import ChannelPage from "./ChannelPage"
import PostPage from "./PostPage"
import ContentPolicyPage from "./ContentPolicyPage"
import AdminPage from "./admin/AdminPage"
import AuthRequiredPage from "./auth/AuthRequiredPage"
import CreatePostPage from "./CreatePostPage"
import ChannelModerationPage from "./ChannelModerationPage"
import SettingsPage from "./SettingsPage"
import ProfilePage from "./ProfilePage"
import ProfileEditPage from "./ProfileEditPage"
import LoginPage from "./auth/LoginPage"
import LoginPasswordPage from "./auth/LoginPasswordPage"
import RegisterPage from "./auth/RegisterPage"
import RegisterConfirmPage from "./auth/RegisterConfirmPage"
import RegisterDetailsPage from "./auth/RegisterDetailsPage"
import InactiveUserPage from "./auth/InactiveUserPage"
import PasswordResetPage from "./auth/PasswordResetPage"
import PasswordResetConfirmPage from "./auth/PasswordResetConfirmPage"
import Snackbar from "../components/material/Snackbar"
import Drawer from "../containers/Drawer"
import Toolbar from "../components/Toolbar"
import Footer from "../components/Footer"

import { actions } from "../actions"
import {
  setShowDrawerMobile,
  setShowDrawerDesktop,
  showDropdown,
  hideDropdown
} from "../actions/ui"
import { setChannelData } from "../actions/channel"
import { AUTH_REQUIRED_URL, SETTINGS_URL } from "../lib/url"
import { isAnonAccessiblePath, needsAuthedSite } from "../lib/auth"
import { isMobileWidth } from "../lib/util"

import type { Location, Match } from "react-router"
import type { Dispatch } from "redux"
import type { SnackbarState } from "../reducers/ui"
import type { Profile } from "../flow/discussionTypes"

export const USER_MENU_DROPDOWN = "USER_MENU_DROPDOWN"

class App extends React.Component<*, void> {
  props: {
    match: Match,
    location: Location,
    showDrawerDesktop: boolean,
    showDrawerMobile: boolean,
    snackbar: SnackbarState,
    dispatch: Dispatch<*>,
    showUserMenu: boolean,
    profile: Profile
  }

  toggleShowDrawer = () => {
    const { dispatch, showDrawerMobile, showDrawerDesktop } = this.props
    dispatch(
      isMobileWidth()
        ? setShowDrawerMobile(!showDrawerMobile)
        : setShowDrawerDesktop(!showDrawerDesktop)
    )
  }

  toggleShowUserMenu = () => {
    const { dispatch, showUserMenu } = this.props

    dispatch(
      showUserMenu
        ? hideDropdown(USER_MENU_DROPDOWN)
        : showDropdown(USER_MENU_DROPDOWN)
    )
  }

  componentDidMount() {
    const {
      location: { pathname }
    } = this.props
    if (needsAuthedSite() || isAnonAccessiblePath(pathname)) {
      return
    }

    this.loadData()
  }

  componentDidUpdate(prevProps) {
    const {
      location: { pathname },
      showDrawerMobile
    } = this.props

    if (
      !pathname.startsWith(SETTINGS_URL) &&
      prevProps.location.pathname.startsWith(SETTINGS_URL)
    ) {
      this.loadData()
    }

    if (
      pathname !== prevProps.location.pathname &&
      showDrawerMobile &&
      isMobileWidth()
    ) {
      this.toggleShowDrawer()
    }
  }

  loadData = async () => {
    const { dispatch } = this.props

    const channels = await dispatch(actions.subscribedChannels.get())
    dispatch(setChannelData(channels))
    if (SETTINGS.username) {
      await dispatch(actions.profiles.get(SETTINGS.username))
    }
  }

  render() {
    const {
      match,
      location: { pathname },
      snackbar,
      showUserMenu,
      profile
    } = this.props

    if (needsAuthedSite() && !isAnonAccessiblePath(pathname)) {
      return <Redirect to={AUTH_REQUIRED_URL} />
    }

    return (
      <div className="app">
        <MetaTags>
          <title>MIT Open Discussions</title>
        </MetaTags>
        <Snackbar snackbar={snackbar} />
        <Toolbar
          toggleShowDrawer={this.toggleShowDrawer}
          toggleShowUserMenu={this.toggleShowUserMenu}
          showUserMenu={showUserMenu}
          profile={profile}
        />
        <Drawer />
        <div className="content">
          <Route exact path={match.url} component={HomePage} />
          <Route
            path={`${match.url}moderation/c/:channelName`}
            component={ChannelModerationPage}
          />
          <Route
            exact
            path={`${match.url}c/:channelName`}
            component={ChannelPage}
          />
          <Route
            exact
            path={`${match.url}c/:channelName/:postID/:postSlug?`}
            component={PostPage}
          />
          <Route
            exact
            path={`${
              match.url
            }c/:channelName/:postID/:postSlug?/comment/:commentID`}
            component={PostPage}
          />
          <Route path={`${match.url}manage/`} component={AdminPage} />
          <Route
            path={`${match.url}create_post/:channelName?`}
            component={CreatePostPage}
          />
          <Route
            path={`${match.url}auth_required/`}
            component={AuthRequiredPage}
          />
          <Route
            path={`${match.url}content_policy/`}
            component={ContentPolicyPage}
          />
          <Route
            exact
            path={`${match.url}settings/:token?`}
            component={SettingsPage}
          />
          <Route
            exact
            path={`${match.url}profile/:userName/edit`}
            component={ProfileEditPage}
          />
          <Route
            exact
            path={`${match.url}profile/:userName`}
            component={ProfilePage}
          />
          <Route exact path={`${match.url}login/`} component={LoginPage} />
          <Route
            exact
            path={`${match.url}login/password/`}
            component={LoginPasswordPage}
          />
          <Route
            exact
            path={`${match.url}register/`}
            component={RegisterPage}
          />
          <Route
            exact
            path={`${match.url}register/confirm/`}
            component={RegisterConfirmPage}
          />
          <Route
            exact
            path={`${match.url}register/details/`}
            component={RegisterDetailsPage}
          />
          <Route
            exact
            path={`${match.url}account/inactive/`}
            component={InactiveUserPage}
          />
          <Route
            exact
            path={`${match.url}password_reset/`}
            component={PasswordResetPage}
          />
          <Route
            exact
            path={`${match.url}password_reset/confirm/:uid/:token`}
            component={PasswordResetConfirmPage}
          />
          <Footer />
        </div>
      </div>
    )
  }
}

export default connect(state => {
  const {
    profiles,
    ui: { showDrawerMobile, showDrawerDesktop, snackbar, dropdownMenus }
  } = state

  const profile = SETTINGS.username
    ? profiles.data.get(SETTINGS.username)
    : null
  const showUserMenu = dropdownMenus.has(USER_MENU_DROPDOWN)

  return {
    showDrawerMobile,
    showDrawerDesktop,
    snackbar,
    showUserMenu,
    profile
  }
})(App)
