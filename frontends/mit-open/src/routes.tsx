import React from "react"
import { RouteObject, Outlet } from "react-router"
import HomePage from "./pages/Home/Home"
import RestrictedRoute from "./components/RestrictedRoute"
import LearningPathListingPage from "./pages/learningpaths/LearningPathListingPage"
import LearningPathDetailsPage from "./pages/learningpaths/LearningPathDetails"
import ArticleDetailsPage from "./pages/articles/ArticleDetailsPage"
import {
  ArticlesCreatePage,
  ArticleEditingPage,
} from "./pages/articles/ArticleUpsertPages"
import ErrorPage from "./pages/errors/ErrorPage"
import * as urls from "./pages/urls"
import * as deprecatedUrls from "./infinite-pages/urls"
import EditFieldPage from "./infinite-pages/field-details/EditFieldPage"
import FieldPage from "./infinite-pages/field-details/FieldPage"

import Header from "./components/Header"
import { isArticleEditor } from "./util/permissions"

const routes: RouteObject[] = [
  {
    element: (
      <>
        <Header />
        <Outlet />
      </>
    ),
    errorElement: <ErrorPage />,
    // Rendered into the Outlet above
    children: [
      {
        path: urls.HOME,
        element: <HomePage />,
      },
      {
        path: urls.LEARNINGPATH_LISTING,
        element: <LearningPathListingPage />,
      },
      {
        path: urls.LEARNINGPATH_VIEW,
        element: <LearningPathDetailsPage />,
      },
      {
        element: <RestrictedRoute allow={isArticleEditor} />,
        children: [
          {
            path: urls.ARTICLES_DETAILS,
            element: <ArticleDetailsPage />,
          },
          {
            path: urls.ARTICLES_EDIT,
            element: <ArticleEditingPage />,
          },
          {
            path: urls.ARTICLES_CREATE,
            element: <ArticlesCreatePage />,
          },
        ],
      },
      {
        path: deprecatedUrls.FIELD_VIEW,
        element: <FieldPage />,
      },
      {
        path: deprecatedUrls.FIELD_EDIT_WIDGETS,
        element: <FieldPage />,
      },
      {
        path: deprecatedUrls.FIELD_EDIT,
        element: <EditFieldPage />,
      },
    ],
  },
]

export default routes
