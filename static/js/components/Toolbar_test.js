// @flow
/* global SETTINGS: false */
import React from "react"
import sinon from "sinon"
import { assert } from "chai"
import { shallow } from "enzyme"

import Toolbar from "./Toolbar"

import { makeProfile } from "../factories/profiles"
import { shouldIf } from "../lib/test_utils"

describe("Toolbar", () => {
  let toggleShowDrawerStub, sandbox

  const renderToolbar = () =>
    shallow(
      <Toolbar
        toggleShowDrawer={toggleShowDrawerStub}
        toggleShowUserMenu={sandbox.stub()}
        showUserMenu={false}
        profile={makeProfile()}
      />,
      { disableLifecycleMethods: true }
    )

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    toggleShowDrawerStub = sandbox.stub()
  })

  afterEach(() => {
    sandbox.restore()
  })

  it("should pass toggleShowDrawer to menu component", () => {
    renderToolbar()
      .find("HamburgerAndLogo")
      .props()
      .onHamburgerClick({
        preventDefault: sandbox.stub()
      })
    assert.ok(toggleShowDrawerStub.called)
  })

  //
  ;[true, false].forEach(isLoggedIn => {
    it(`should ${isLoggedIn ? "" : "not"} display UserMenu if user is logged ${
      isLoggedIn ? "in" : "out"
    }`, () => {
      SETTINGS.username = isLoggedIn ? "username" : null
      assert.equal(
        renderToolbar()
          .find("UserMenu")
          .exists(),
        isLoggedIn
      )
    })
  })

  //
  ;[[true, "enabled"], [false, "disabled"]].forEach(
    ([isEmailEnabled, desc]) => {
      it(`${shouldIf(
        isEmailEnabled
      )} display login button if allow_email_auth is ${desc}`, () => {
        SETTINGS.username = null
        SETTINGS.allow_email_auth = isEmailEnabled
        assert.equal(
          renderToolbar()
            .find("Link")
            .exists(),
          isEmailEnabled
        )
      })
    }
  )
})
