"""Synthetic warehouse-source row factories.

Unlike learning_resources.factories (Django ORM models), these produce plain
dicts shaped like rows from an integrations__learn__* warehouse view — used
to seed a local StarRocks table so BaseWarehouseETLTask/iter_rows can be
exercised against real SQL instead of a mocked cursor (see
warehouse_integration_test.py). Each per-source PR (mitxonline, xpro,
mit_edx, ocw, program_certificates) should add its own factory here matching
that source's actual view schema, alongside its transform function.
"""

import factory

from main.utils import now_in_utc


class WarehouseTestRowFactory(factory.DictFactory):
    """Generic row factory for the machinery's own scratch test table.

    Matches the `integrations__learn__test` view name convention already
    used by warehouse_test.py's mock-based tests — not tied to any real
    Cohort-1 source's schema, just enough columns to exercise iter_rows'
    since-filtering and BaseWarehouseETLTask's fetch/watermark cycle.
    """

    id = factory.Sequence(lambda n: n)
    title = factory.Faker("sentence", nb_words=4)
    last_modified = factory.LazyFunction(now_in_utc)
