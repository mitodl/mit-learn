"""Factories for making test data"""

import factory
from factory.django import DjangoModelFactory

from website_content import models

from website_content.constants import WebsiteContentType


class WebsiteContentFactory(DjangoModelFactory):
    """Factory for WebsiteContent"""

    content = factory.LazyFunction(lambda: {"type": "doc", "content": []})
    title = factory.Faker("sentence", nb_words=4)
    content_type = WebsiteContentType.news.name

    class Meta:
        model = models.WebsiteContent
