"""Testing factories for content_feedback"""

from factory import Faker, SubFactory
from factory.django import DjangoModelFactory
from factory.fuzzy import FuzzyChoice

from content_feedback.constants import ContentFeedbackSentiment
from content_feedback.models import ContentFeedback
from main.factories import UserFactory


class ContentFeedbackFactory(DjangoModelFactory):
    """Factory for ContentFeedback"""

    user = SubFactory(UserFactory)
    course_id = Faker("bothify", text="course-v1:MITx+#.##+?T20##")
    course_name = Faker("sentence", nb_words=4)
    block_usage_key = Faker("bothify", text="block-v1:MITx+type@video+block@????????")
    block_type = FuzzyChoice(["video", "problem", "html"])
    block_display_name = Faker("sentence", nb_words=3)
    unit_title = Faker("sentence", nb_words=3)
    url = Faker("url")
    sentiment = FuzzyChoice([m.name for m in ContentFeedbackSentiment])
    comment = Faker("paragraph")

    class Meta:
        """Meta options for the factory"""

        model = ContentFeedback
