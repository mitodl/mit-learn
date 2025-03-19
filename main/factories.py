"""
Factory for Users
"""

import ulid
from django.conf import settings
from factory import (
    Faker,
    LazyFunction,
    RelatedFactory,
    SelfAttribute,
    SubFactory,
    Trait,
)
from factory.django import DjangoModelFactory
from factory.fuzzy import FuzzyText
from social_django.models import UserSocialAuth


class UserFactory(DjangoModelFactory):
    """Factory for Users"""

    username = LazyFunction(lambda: ulid.new().str)
    email = FuzzyText(suffix="@example.com")
    first_name = Faker("first_name")
    last_name = Faker("last_name")

    profile = RelatedFactory("profiles.factories.ProfileFactory", "user")

    scim_external_id = Faker("uuid4")
    scim_username = SelfAttribute("email")

    global_id = SelfAttribute("scim_external_id")

    class Meta:
        model = settings.AUTH_USER_MODEL
        skip_postgeneration_save = True

    class Params:
        no_profile = Trait(profile=None)


class GroupFactory(DjangoModelFactory):
    """Factory for Groups"""

    name = FuzzyText()

    class Meta:
        model = "auth.Group"


class UserSocialAuthFactory(DjangoModelFactory):
    """Factory for UserSocialAuth"""

    provider = FuzzyText()
    user = SubFactory(UserFactory)
    uid = FuzzyText()

    class Meta:
        model = UserSocialAuth
