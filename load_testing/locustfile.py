import os
import random

from locust import HttpUser, TaskSet, between, constant, events, tag, task


@events.init_command_line_parser.add_listener
def add_custom_options(parser):
    parser.add_argument(
        "--consistent-queries",
        action="store_true",
        default=False,
        help="Use consistent query parameters (no random pagination) for cache testing",
    )
    parser.add_argument(
        "--session-id",
        type=str,
        default=None,
        help="Session ID for authenticated requests.",
    )


class Site(TaskSet):
    """TaskSet for site-level tasks"""

    wait_time = constant(1)

    @task
    def user_data(self):
        """Request the user's data"""
        self.client.get("/api/v0/users/me/")


class HomePage(TaskSet):
    """TaskSet for HomePage"""

    @tag("home")
    @task
    def testimonials(self):
        """Testimonials"""
        self.client.get("/api/v0/testimonials/", data={"position": 1})

    @tag("home")
    @task
    def news(self):
        """News"""
        self.client.get(
            "/api/v0/news_events/",
            data={"feed_type": "news", "limit": 6, "sortby": "-created"},
        )
        self.client.get(
            "/api/v0/news_events/",
            data={"feed_type": "events", "limit": 5, "sortby": "event_date"},
        )

    @tag("home")
    @task
    def learning_resources(self):
        """Learning Resources"""
        self.client.get("/api/v1/featured/", data={"limit": 12})
        self.client.get("/api/v1/featured/", data={"free": "true", "limit": 12})
        self.client.get("/api/v1/featured/", data={"professional": "true", "limit": 12})
        self.client.get(
            "/api/v1/featured/",
            data={"professional": "false", "certification": "true", "limit": 12},
        )

        self.client.get(
            "/api/v1/learning_resources/",
            data={
                "limit": 12,
                "resource_type": ["video", "podcast_episode"],
                "sortby": "new",
            },
        )
        self.client.get(
            "/api/v1/learning_resources/",
            data={"limit": 12, "resource_type": "video", "sortby": "new"},
        )
        self.client.get(
            "/api/v1/learning_resources/",
            data={"limit": 12, "resource_type": "podcast_episode", "sortby": "new"},
        )

        self.client.get("/api/v1/topics/", data={"is_toplevel": "true"})


class SearchPage(TaskSet):
    """TaskSet for search APIs"""

    wait_time = between(1, 10)

    def _query(self, *, page: int = 0, filters: dict | None = None):
        return {
            "aggregations": [
                "resource_type",
                "certification_type",
                "delivery",
                "department",
                "topic",
                "offered_by",
                "free",
                "professional",
                "resource_category",
            ],
            "limit": 20,
            "offset": page * 20,
            **(filters or {}),
        }

    def _walk_pages(self):
        """Return a range of page numbers (consistent or random based on option)"""
        if self.user.environment.parsed_options.consistent_queries:
            return range(1)  # Just page 0
        return range(random.randint(1, 10))  # noqa: S311

    @tag("search")
    @task
    def popular(self):
        """Search for popular learning resources"""
        for page in self._walk_pages():
            self.client.get(
                "/api/v1/learning_resources_search/",
                data=self._query(
                    page=page,
                    filters={
                        "sortby": "-views",
                    },
                ),
            )

    @tag("search")
    @task
    def upcoming(self):
        """Search for upcoming learning resources"""
        for page in self._walk_pages():
            self.client.get(
                "/api/v1/learning_resources_search/",
                data=self._query(
                    page=page,
                    filters={
                        "sortby": "upcoming",
                    },
                ),
            )

    @tag("search")
    @task
    def free(self):
        """Search for free learning resources"""
        for page in self._walk_pages():
            self.client.get(
                "/api/v1/learning_resources_search/",
                data=self._query(
                    page=page,
                    filters={
                        "free": "true",
                    },
                ),
            )

    @tag("search")
    @task
    def new(self):
        """Search for new learning resources"""
        for page in self._walk_pages():
            self.client.get(
                "/api/v1/learning_resources_search/",
                data=self._query(
                    page=page,
                    filters={
                        "new": "true",
                    },
                ),
            )


class LearnUser(HttpUser):
    """Abstract User"""

    abstract = True

    tasks = {
        HomePage: 2,
        SearchPage: 20,
    }


class AnonymousUser(LearnUser):
    """Anonymous user"""


class AuthenticatedUser(LearnUser):
    """
    Authenticated user that uses a session cookie.

    Log in as the user you want to test with in a browser.
    Then copy the session cookie value and paste into the UI
    under the "Custom Parameters" section for "Session ID"

    From the command line, run locust with the session:
        locust --session-id="<session_key>" -u 10 -r 1 --tags search

    Requires DISABLE_APISIX_USER_MIDDLEWARE=True in your backend env.
    """

    def on_start(self):
        """Set up session cookie for authenticated requests."""
        session_id = self.environment.parsed_options.session_id
        if session_id:
            # Get cookie name from env or use default
            cookie_name = os.environ.get("SESSION_COOKIE_NAME", "sessionid")
            self.client.cookies.set(cookie_name, session_id)
        else:
            msg = "AuthenticatedUser requires --session-id argument"
            raise ValueError(msg)
