"""Factories for making test data"""

import factory
from factory.django import DjangoModelFactory

from articles import models


class ArticleFactory(DjangoModelFactory):
    """Factory for Articles"""

    content = factory.LazyFunction(lambda: {"type": "doc", "content": []})
    title = factory.Faker("sentence", nb_words=4)

    class Meta:
        model = models.Article
