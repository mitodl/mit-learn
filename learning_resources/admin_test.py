"""Tests for learning_resources admin"""

import pytest
from django.contrib.admin.sites import site
from django.test import RequestFactory
from django.urls import reverse

from learning_resources.admin import TutorProblemFileAdmin
from learning_resources.factories import (
    LearningResourceRunFactory,
    TutorProblemFileFactory,
)
from learning_resources.models import TutorProblemFile


@pytest.mark.django_db
def test_tutor_problem_file_changelist_query_count(
    admin_user, django_assert_num_queries
):
    """Changelist query count should not grow with the number of rows"""
    for _ in range(5):
        TutorProblemFileFactory.create(run=LearningResourceRunFactory.create())
    request = RequestFactory().get(
        reverse("admin:learning_resources_tutorproblemfile_changelist")
    )
    request.user = admin_user
    model_admin = TutorProblemFileAdmin(TutorProblemFile, site)
    with django_assert_num_queries(3):
        model_admin.changelist_view(request).render()
