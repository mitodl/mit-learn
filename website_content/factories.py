"""Factories for making test data"""

import factory
from factory.django import DjangoModelFactory

from website_content import models
from website_content.constants import CONTENT_TYPE_NEWS


class WebsiteContentFactory(DjangoModelFactory):
    """Factory for WebsiteContent"""

    content = factory.LazyFunction(lambda: {"type": "doc", "content": []})
    title = factory.Faker("sentence", nb_words=4)
    content_type = CONTENT_TYPE_NEWS

    class Meta:
        model = models.WebsiteContent
