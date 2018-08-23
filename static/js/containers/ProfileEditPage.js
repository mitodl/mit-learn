// @flow
/* global SETTINGS:false */
import React from "react"
import { connect } from "react-redux"
import R from "ramda"
import { MetaTags } from "react-meta-tags"

import ProfileForm from "../components/ProfileForm"
import Card from "../components/Card"
import Loading from "../components/Loading"
import withSingleColumn from "../hoc/withSingleColumn"

import { actions } from "../actions"
import { formatTitle } from "../lib/title"
import { getUserName } from "../lib/util"
import { profileURL } from "../lib/url"
import { Redirect } from "react-router"
import { validateProfileForm } from "../lib/validation"
import { any404Error, anyErrorExcept404 } from "../util/rest"

import type { Profile } from "../flow/discussionTypes"
import type { FormValue } from "../flow/formTypes"
import type { ProfilePayload } from "../flow/discussionTypes"
import type { Dispatch } from "redux"
import type { LoadingProps } from "../components/Loading"

type Props = {
  dispatch: Dispatch<*>,
  history: Object,
  profileForm: FormValue<ProfilePayload>,
  processing: boolean,
  profile: Profile,
  userName: string
} & LoadingProps

const PROFILE_KEY = "profile:edit"
const EDIT_PROFILE_PAYLOAD = { formKey: PROFILE_KEY }
const getForm = R.prop(PROFILE_KEY)

export const editProfileForm = (profile: Profile): ProfilePayload =>
  R.pickAll(["name", "bio", "headline"], profile)

class ProfileEditPage extends React.Component<Props> {
  beginFormEdit() {
    const { dispatch, profile } = this.props
    dispatch(
      actions.forms.formBeginEdit(
        R.merge(EDIT_PROFILE_PAYLOAD, {
          value: editProfileForm(profile)
        })
      )
    )
  }

  componentDidMount() {
    const { profile } = this.props
    if (!profile) {
      this.loadData()
    } else {
      this.beginFormEdit()
    }
  }

  loadData = async () => {
    const { dispatch, userName } = this.props
    await dispatch(actions.profiles.get(userName))
    this.beginFormEdit()
  }

  componentWillUnmount() {
    const { dispatch } = this.props
    dispatch(actions.forms.formEndEdit(EDIT_PROFILE_PAYLOAD))
  }

  onUpdate = async (e: Object) => {
    const { dispatch } = this.props
    const { name, value } = e.target

    dispatch(
      actions.forms.formUpdate({
        ...EDIT_PROFILE_PAYLOAD,
        value: {
          [name]: value
        }
      })
    )
  }

  onSubmit = (e: Object) => {
    const { dispatch, history, profileForm, profile } = this.props

    e.preventDefault()

    const validation = validateProfileForm(profileForm)

    if (!profileForm || !R.isEmpty(validation)) {
      dispatch(
        actions.forms.formValidate({
          ...EDIT_PROFILE_PAYLOAD,
          errors: validation.value
        })
      )
    } else {
      dispatch(
        actions.profiles.patch(profile.username, profileForm.value)
      ).then(profile => {
        history.push(`/profile/${profile.username}/`)
      })
    }
  }

  renderPage = () => {
    const { profile, profileForm, processing, history } = this.props
    if (!profile || !profileForm) {
      return null
    }

    return profile.username === SETTINGS.username ? (
      <div className="profile-page">
        <MetaTags>
          <title>{formatTitle("Edit your profile")}</title>
        </MetaTags>
        <div className="main-content">
          <Card>
            <div className="profile-card">
              <ProfileForm
                profile={profile}
                onSubmit={this.onSubmit}
                onUpdate={this.onUpdate}
                form={profileForm.value}
                validation={profileForm.errors}
                history={history}
                processing={processing}
              />
            </div>
          </Card>
        </div>
      </div>
    ) : (
      <Redirect to={profileURL(profile.username)} />
    )
  }

  render() {
    const { loaded, errored, notAuthorized, notFound } = this.props
    return (
      <Loading
        loaded={loaded}
        errored={errored}
        notAuthorized={notAuthorized}
        notFound={notFound}
      >
        {this.renderPage()}
      </Loading>
    )
  }
}

const mapStateToProps = (state, ownProps) => {
  const { profiles } = state
  const userName = getUserName(ownProps)
  const profileForm = getForm(state.forms)
  const processing = state.profiles.processing
  const profile = profiles.data.get(userName)
  const errored = anyErrorExcept404([profiles])
  const notFound = any404Error([profiles])
  const loaded = notFound ? true : R.none(R.isNil, [profile])
  return {
    processing,
    profile,
    profileForm,
    userName,
    notFound,
    errored,
    loaded
  }
}

export default R.compose(
  connect(mapStateToProps),
  withSingleColumn("profile-edit-page")
)(ProfileEditPage)
