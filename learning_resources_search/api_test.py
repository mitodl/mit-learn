"""Search API function tests"""

from unittest.mock import MagicMock, Mock

import pytest
from freezegun import freeze_time
from opensearch_dsl import response
from opensearch_dsl.query import Percolate

from learning_resources.factories import LearningResourceFactory
from learning_resources_search.api import (
    Search,
    construct_search,
    execute_learn_search,
    generate_aggregation_clause,
    generate_aggregation_clauses,
    generate_content_file_text_clause,
    generate_filter_clause,
    generate_filter_clauses,
    generate_learning_resources_text_clause,
    generate_sort_clause,
    generate_suggest_clause,
    get_similar_topics,
    get_similar_topics_qdrant,
    percolate_matches_for_document,
    relevant_indexes,
)
from learning_resources_search.constants import (
    CONTENT_FILE_TYPE,
    COURSE_TYPE,
    LEARNING_RESOURCE,
)
from learning_resources_search.factories import PercolateQueryFactory
from learning_resources_search.models import PercolateQuery


def os_topic(topic_name) -> Mock:
    """
    Given a topic name, return a mock object emulating an
    OpenSearch topic AttrDict object
    """
    return Mock(to_dict=Mock(return_value={"name": topic_name}))


@pytest.mark.parametrize(
    ("endpoint", "resourse_types", "aggregations", "result"),
    [
        (LEARNING_RESOURCE, ["course"], [], ["testindex_course_default"]),
        (
            LEARNING_RESOURCE,
            ["course"],
            ["resource_type"],
            [
                "testindex_course_default",
                "testindex_program_default",
                "testindex_podcast_default",
                "testindex_podcast_episode_default",
                "testindex_video_default",
                "testindex_video_playlist_default",
                "testindex_article_default",
            ],
        ),
        (CONTENT_FILE_TYPE, ["content_file"], [], ["testindex_course_default"]),
    ],
)
def test_relevant_indexes(endpoint, resourse_types, aggregations, result):
    assert (
        list(
            relevant_indexes(
                resourse_types, aggregations, endpoint, use_hybrid_search=False
            )
        )
        == result
    )
    # always return the hybrid index when use_hybrid_search is True
    if endpoint == LEARNING_RESOURCE:
        assert list(
            relevant_indexes(
                resourse_types, aggregations, endpoint, use_hybrid_search=True
            )
        ) == ["testindex_combined_hybrid_default"]


@pytest.mark.parametrize(
    ("sort_param", "departments", "result"),
    [
        ("id", None, "id"),
        ("-id", ["7"], "-id"),
        (
            "start_date",
            ["5"],
            {"runs.start_date": {"order": "asc", "nested": {"path": "runs"}}},
        ),
        (
            "-start_date",
            None,
            {"runs.start_date": {"order": "desc", "nested": {"path": "runs"}}},
        ),
        (
            "mitcoursenumber",
            None,
            {
                "course.course_numbers.sort_coursenum": {
                    "order": "asc",
                    "nested": {
                        "path": "course.course_numbers",
                        "filter": {"term": {"course.course_numbers.primary": True}},
                    },
                }
            },
        ),
        (
            "mitcoursenumber",
            ["7", "5"],
            {
                "course.course_numbers.sort_coursenum": {
                    "order": "asc",
                    "nested": {
                        "path": "course.course_numbers",
                        "filter": {
                            "bool": {
                                "should": [
                                    {
                                        "term": {
                                            "course.course_numbers.department.department_id": (
                                                "7"
                                            )
                                        }
                                    },
                                    {
                                        "term": {
                                            "course.course_numbers.department.department_id": (
                                                "5"
                                            )
                                        }
                                    },
                                ]
                            }
                        },
                    },
                }
            },
        ),
    ],
)
def test_generate_sort_clause(sort_param, departments, result):
    params = {"sortby": sort_param, "department": departments}
    assert generate_sort_clause(params) == result


@pytest.mark.parametrize(
    "search_mode", ["best_fields", "most_fields", "phrase", "hybrid", None]
)
@pytest.mark.parametrize("slop", [None, 2])
@pytest.mark.parametrize("content_file_score_weight", [None, 0, 0.5, 1])
def test_generate_learning_resources_text_clause(
    settings, search_mode, slop, content_file_score_weight
):
    extra_params = {}
    settings.DEFAULT_SEARCH_MODE = "phrase"

    if search_mode == "hybrid":
        extra_params["type"] = "phrase"
    elif search_mode:
        extra_params["type"] = search_mode

    if extra_params.get("type") == "phrase" and slop:
        extra_params["slop"] = slop

    min_score = 0

    if content_file_score_weight is None:
        content_file_fields = [
            "content.english",
            "title.english",
            "content_title.english",
            "description.english",
            "content_feature_type",
        ]
    else:
        content_file_fields = [
            f"content.english^{content_file_score_weight}",
            f"title.english^{content_file_score_weight}",
            f"content_title.english^{content_file_score_weight}",
            f"description.english^{content_file_score_weight}",
            f"content_feature_type^{content_file_score_weight}",
        ]

    result1 = {
        "bool": {
            "filter": {
                "bool": {
                    "must": [
                        {
                            "bool": {
                                "should": [
                                    {
                                        "multi_match": {
                                            "query": "math",
                                            "fields": [
                                                "title.english^3",
                                                "description.english^2",
                                                "full_description.english",
                                                "platform.name",
                                                "readable_id",
                                                "offered_by",
                                                "course_feature",
                                                "video.transcript.english",
                                            ],
                                            **extra_params,
                                        }
                                    },
                                    {
                                        "nested": {
                                            "path": "topics",
                                            "query": {
                                                "multi_match": {
                                                    "query": "math",
                                                    "fields": ["topics.name"],
                                                    **extra_params,
                                                }
                                            },
                                        }
                                    },
                                    {
                                        "nested": {
                                            "path": "departments",
                                            "query": {
                                                "multi_match": {
                                                    "query": "math",
                                                    "fields": [
                                                        "departments.department_id",
                                                        "departments.name",
                                                    ],
                                                    **extra_params,
                                                }
                                            },
                                        }
                                    },
                                    {
                                        "nested": {
                                            "path": "certification_type",
                                            "query": {
                                                "multi_match": {
                                                    "query": "math",
                                                    "fields": [
                                                        "certification_type.name.english^5",
                                                    ],
                                                    **extra_params,
                                                }
                                            },
                                        }
                                    },
                                    {
                                        "nested": {
                                            "path": "course.course_numbers",
                                            "query": {
                                                "multi_match": {
                                                    "query": "math",
                                                    "fields": [
                                                        "course.course_numbers.value^5",
                                                    ],
                                                    **extra_params,
                                                }
                                            },
                                        }
                                    },
                                    {
                                        "nested": {
                                            "path": "runs",
                                            "query": {
                                                "multi_match": {
                                                    "query": "math",
                                                    "fields": [
                                                        "runs.year",
                                                        "runs.semester",
                                                    ],
                                                    **extra_params,
                                                }
                                            },
                                        }
                                    },
                                    {
                                        "nested": {
                                            "path": "runs",
                                            "query": {
                                                "nested": {
                                                    "path": "runs.instructors",
                                                    "query": {
                                                        "multi_match": {
                                                            "query": "math",
                                                            "fields": [
                                                                "runs.instructors.last_name^5",
                                                                "runs.instructors.full_name^5",
                                                            ],
                                                            **extra_params,
                                                        }
                                                    },
                                                }
                                            },
                                        }
                                    },
                                    {
                                        "nested": {
                                            "path": "runs",
                                            "query": {
                                                "nested": {
                                                    "path": "runs.level",
                                                    "query": {
                                                        "multi_match": {
                                                            "fields": [
                                                                "runs.level.name^5",
                                                            ],
                                                            "query": "math",
                                                            **extra_params,
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                ]
                            }
                        }
                    ]
                }
            },
            "should": [
                {
                    "multi_match": {
                        "query": "math",
                        "fields": [
                            "title.english^3",
                            "description.english^2",
                            "full_description.english",
                            "platform.name",
                            "readable_id",
                            "offered_by",
                            "course_feature",
                            "video.transcript.english",
                        ],
                        **extra_params,
                    }
                },
                {
                    "nested": {
                        "path": "topics",
                        "query": {
                            "multi_match": {
                                "query": "math",
                                "fields": ["topics.name"],
                                **extra_params,
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "departments",
                        "query": {
                            "multi_match": {
                                "query": "math",
                                "fields": [
                                    "departments.department_id",
                                    "departments.name",
                                ],
                                **extra_params,
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "certification_type",
                        "query": {
                            "multi_match": {
                                "query": "math",
                                "fields": [
                                    "certification_type.name.english^5",
                                ],
                                **extra_params,
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "course.course_numbers",
                        "query": {
                            "multi_match": {
                                "query": "math",
                                "fields": [
                                    "course.course_numbers.value^5",
                                ],
                                **extra_params,
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "runs",
                        "query": {
                            "multi_match": {
                                "query": "math",
                                "fields": ["runs.year", "runs.semester"],
                                **extra_params,
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "runs",
                        "query": {
                            "nested": {
                                "path": "runs.instructors",
                                "query": {
                                    "multi_match": {
                                        "query": "math",
                                        "fields": [
                                            "runs.instructors.last_name^5",
                                            "runs.instructors.full_name^5",
                                        ],
                                        **extra_params,
                                    }
                                },
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "runs",
                        "query": {
                            "nested": {
                                "path": "runs.level",
                                "query": {
                                    "multi_match": {
                                        "fields": [
                                            "runs.level.name^5",
                                        ],
                                        "query": "math",
                                        **extra_params,
                                    },
                                },
                            },
                        },
                    }
                },
            ],
        }
    }

    has_child_multi_match = {
        "has_child": {
            "type": "content_file",
            "query": {
                "multi_match": {
                    "query": "math",
                    "fields": content_file_fields,
                    **extra_params,
                }
            },
            "score_mode": "avg",
        }
    }
    if content_file_score_weight != 0:
        result1["bool"]["filter"]["bool"]["must"][0]["bool"]["should"].append(
            has_child_multi_match
        )
        result1["bool"]["should"].append(has_child_multi_match)

    result2 = {
        "bool": {
            "filter": {
                "bool": {
                    "must": [
                        {
                            "bool": {
                                "should": [
                                    {
                                        "query_string": {
                                            "query": '"math"',
                                            "fields": [
                                                "title.english^3",
                                                "description.english^2",
                                                "full_description.english",
                                                "platform.name",
                                                "readable_id",
                                                "offered_by",
                                                "course_feature",
                                                "video.transcript.english",
                                            ],
                                        }
                                    },
                                    {
                                        "nested": {
                                            "path": "topics",
                                            "query": {
                                                "query_string": {
                                                    "query": '"math"',
                                                    "fields": ["topics.name"],
                                                }
                                            },
                                        }
                                    },
                                    {
                                        "nested": {
                                            "path": "departments",
                                            "query": {
                                                "query_string": {
                                                    "query": '"math"',
                                                    "fields": [
                                                        "departments.department_id",
                                                        "departments.name",
                                                    ],
                                                }
                                            },
                                        }
                                    },
                                    {
                                        "nested": {
                                            "path": "certification_type",
                                            "query": {
                                                "query_string": {
                                                    "fields": [
                                                        "certification_type.name.english^5",
                                                    ],
                                                    "query": '"math"',
                                                },
                                            },
                                        },
                                    },
                                    {
                                        "nested": {
                                            "path": "course.course_numbers",
                                            "query": {
                                                "query_string": {
                                                    "query": '"math"',
                                                    "fields": [
                                                        "course.course_numbers.value^5",
                                                    ],
                                                }
                                            },
                                        }
                                    },
                                    {
                                        "nested": {
                                            "path": "runs",
                                            "query": {
                                                "query_string": {
                                                    "query": '"math"',
                                                    "fields": [
                                                        "runs.year",
                                                        "runs.semester",
                                                    ],
                                                }
                                            },
                                        }
                                    },
                                    {
                                        "nested": {
                                            "path": "runs",
                                            "query": {
                                                "nested": {
                                                    "path": "runs.instructors",
                                                    "query": {
                                                        "query_string": {
                                                            "query": '"math"',
                                                            "fields": [
                                                                "runs.instructors.last_name^5",
                                                                "runs.instructors.full_name^5",
                                                            ],
                                                        }
                                                    },
                                                }
                                            },
                                        }
                                    },
                                    {
                                        "nested": {
                                            "path": "runs",
                                            "query": {
                                                "nested": {
                                                    "path": "runs.level",
                                                    "query": {
                                                        "query_string": {
                                                            "fields": [
                                                                "runs.level.name^5",
                                                            ],
                                                            "query": '"math"',
                                                        },
                                                    },
                                                },
                                            },
                                        }
                                    },
                                ]
                            }
                        }
                    ]
                }
            },
            "should": [
                {
                    "query_string": {
                        "query": '"math"',
                        "fields": [
                            "title.english^3",
                            "description.english^2",
                            "full_description.english",
                            "platform.name",
                            "readable_id",
                            "offered_by",
                            "course_feature",
                            "video.transcript.english",
                        ],
                    }
                },
                {
                    "nested": {
                        "path": "topics",
                        "query": {
                            "query_string": {
                                "query": '"math"',
                                "fields": ["topics.name"],
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "departments",
                        "query": {
                            "query_string": {
                                "query": '"math"',
                                "fields": [
                                    "departments.department_id",
                                    "departments.name",
                                ],
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "certification_type",
                        "query": {
                            "query_string": {
                                "fields": [
                                    "certification_type.name.english^5",
                                ],
                                "query": '"math"',
                            },
                        },
                    },
                },
                {
                    "nested": {
                        "path": "course.course_numbers",
                        "query": {
                            "query_string": {
                                "query": '"math"',
                                "fields": [
                                    "course.course_numbers.value^5",
                                ],
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "runs",
                        "query": {
                            "query_string": {
                                "query": '"math"',
                                "fields": ["runs.year", "runs.semester"],
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "runs",
                        "query": {
                            "nested": {
                                "path": "runs.instructors",
                                "query": {
                                    "query_string": {
                                        "query": '"math"',
                                        "fields": [
                                            "runs.instructors.last_name^5",
                                            "runs.instructors.full_name^5",
                                        ],
                                    }
                                },
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "runs",
                        "query": {
                            "nested": {
                                "path": "runs.level",
                                "query": {
                                    "query_string": {
                                        "fields": [
                                            "runs.level.name^5",
                                        ],
                                        "query": '"math"',
                                    },
                                },
                            },
                        },
                    },
                },
            ],
        }
    }

    has_child_query_string = {
        "has_child": {
            "type": "content_file",
            "query": {
                "query_string": {
                    "query": '"math"',
                    "fields": content_file_fields,
                }
            },
            "score_mode": "avg",
        }
    }
    if content_file_score_weight != 0:
        result2["bool"]["filter"]["bool"]["must"][0]["bool"]["should"].append(
            has_child_query_string
        )
        result2["bool"]["should"].append(has_child_query_string)

    assert (
        generate_learning_resources_text_clause(
            "math", search_mode, slop, content_file_score_weight, min_score
        )
        == result1
    )
    assert (
        generate_learning_resources_text_clause(
            '"math"', search_mode, slop, content_file_score_weight, min_score
        )
        == result2
    )


def test_generate_learning_resources_text_clause_with_min_score():
    search_mode = "phrase"
    slop = 2
    content_file_score_weight = 0.5
    min_score = 10

    result1 = {
        "bool": {
            "filter": {
                "bool": {
                    "must": [
                        {
                            "function_score": {
                                "query": {
                                    "bool": {
                                        "should": [
                                            {
                                                "multi_match": {
                                                    "query": "math",
                                                    "fields": [
                                                        "title.english^3",
                                                        "description.english^2",
                                                        "full_description.english",
                                                        "platform.name",
                                                        "readable_id",
                                                        "offered_by",
                                                        "course_feature",
                                                        "video.transcript.english",
                                                    ],
                                                    "type": "phrase",
                                                    "slop": 2,
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "topics",
                                                    "query": {
                                                        "multi_match": {
                                                            "query": "math",
                                                            "fields": ["topics.name"],
                                                            "type": "phrase",
                                                            "slop": 2,
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "departments",
                                                    "query": {
                                                        "multi_match": {
                                                            "query": "math",
                                                            "fields": [
                                                                "departments.department_id",
                                                                "departments.name",
                                                            ],
                                                            "type": "phrase",
                                                            "slop": 2,
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "certification_type",
                                                    "query": {
                                                        "multi_match": {
                                                            "query": "math",
                                                            "fields": [
                                                                "certification_type.name.english^5"
                                                            ],
                                                            "type": "phrase",
                                                            "slop": 2,
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "course.course_numbers",
                                                    "query": {
                                                        "multi_match": {
                                                            "query": "math",
                                                            "fields": [
                                                                "course.course_numbers.value^5"
                                                            ],
                                                            "type": "phrase",
                                                            "slop": 2,
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "runs",
                                                    "query": {
                                                        "multi_match": {
                                                            "query": "math",
                                                            "fields": [
                                                                "runs.year",
                                                                "runs.semester",
                                                            ],
                                                            "type": "phrase",
                                                            "slop": 2,
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "runs",
                                                    "query": {
                                                        "nested": {
                                                            "path": "runs.instructors",
                                                            "query": {
                                                                "multi_match": {
                                                                    "query": "math",
                                                                    "fields": [
                                                                        "runs.instructors.last_name^5",
                                                                        "runs.instructors.full_name^5",
                                                                    ],
                                                                    "type": "phrase",
                                                                    "slop": 2,
                                                                }
                                                            },
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "runs",
                                                    "query": {
                                                        "nested": {
                                                            "path": "runs.level",
                                                            "query": {
                                                                "multi_match": {
                                                                    "query": "math",
                                                                    "fields": [
                                                                        "runs.level.name^5"
                                                                    ],
                                                                    "type": "phrase",
                                                                    "slop": 2,
                                                                }
                                                            },
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "has_child": {
                                                    "type": "content_file",
                                                    "query": {
                                                        "multi_match": {
                                                            "query": "math",
                                                            "fields": [
                                                                "content.english^0.5",
                                                                "title.english^0.5",
                                                                "content_title.english^0.5",
                                                                "description.english^0.5",
                                                                "content_feature_type^0.5",
                                                            ],
                                                            "type": "phrase",
                                                            "slop": 2,
                                                        }
                                                    },
                                                    "score_mode": "avg",
                                                }
                                            },
                                        ]
                                    }
                                },
                                "min_score": 10,
                            }
                        }
                    ]
                }
            },
            "should": [
                {
                    "multi_match": {
                        "query": "math",
                        "fields": [
                            "title.english^3",
                            "description.english^2",
                            "full_description.english",
                            "platform.name",
                            "readable_id",
                            "offered_by",
                            "course_feature",
                            "video.transcript.english",
                        ],
                        "type": "phrase",
                        "slop": 2,
                    }
                },
                {
                    "nested": {
                        "path": "topics",
                        "query": {
                            "multi_match": {
                                "query": "math",
                                "fields": ["topics.name"],
                                "type": "phrase",
                                "slop": 2,
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "departments",
                        "query": {
                            "multi_match": {
                                "query": "math",
                                "fields": [
                                    "departments.department_id",
                                    "departments.name",
                                ],
                                "type": "phrase",
                                "slop": 2,
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "certification_type",
                        "query": {
                            "multi_match": {
                                "query": "math",
                                "fields": ["certification_type.name.english^5"],
                                "type": "phrase",
                                "slop": 2,
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "course.course_numbers",
                        "query": {
                            "multi_match": {
                                "query": "math",
                                "fields": ["course.course_numbers.value^5"],
                                "type": "phrase",
                                "slop": 2,
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "runs",
                        "query": {
                            "multi_match": {
                                "query": "math",
                                "fields": ["runs.year", "runs.semester"],
                                "type": "phrase",
                                "slop": 2,
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "runs",
                        "query": {
                            "nested": {
                                "path": "runs.instructors",
                                "query": {
                                    "multi_match": {
                                        "query": "math",
                                        "fields": [
                                            "runs.instructors.last_name^5",
                                            "runs.instructors.full_name^5",
                                        ],
                                        "type": "phrase",
                                        "slop": 2,
                                    }
                                },
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "runs",
                        "query": {
                            "nested": {
                                "path": "runs.level",
                                "query": {
                                    "multi_match": {
                                        "query": "math",
                                        "fields": ["runs.level.name^5"],
                                        "type": "phrase",
                                        "slop": 2,
                                    }
                                },
                            }
                        },
                    }
                },
                {
                    "has_child": {
                        "type": "content_file",
                        "query": {
                            "multi_match": {
                                "query": "math",
                                "fields": [
                                    "content.english^0.5",
                                    "title.english^0.5",
                                    "content_title.english^0.5",
                                    "description.english^0.5",
                                    "content_feature_type^0.5",
                                ],
                                "type": "phrase",
                                "slop": 2,
                            }
                        },
                        "score_mode": "avg",
                    }
                },
            ],
        }
    }
    result2 = {
        "bool": {
            "filter": {
                "bool": {
                    "must": [
                        {
                            "function_score": {
                                "query": {
                                    "bool": {
                                        "should": [
                                            {
                                                "query_string": {
                                                    "query": '"math"',
                                                    "fields": [
                                                        "title.english^3",
                                                        "description.english^2",
                                                        "full_description.english",
                                                        "platform.name",
                                                        "readable_id",
                                                        "offered_by",
                                                        "course_feature",
                                                        "video.transcript.english",
                                                    ],
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "topics",
                                                    "query": {
                                                        "query_string": {
                                                            "query": '"math"',
                                                            "fields": ["topics.name"],
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "departments",
                                                    "query": {
                                                        "query_string": {
                                                            "query": '"math"',
                                                            "fields": [
                                                                "departments.department_id",
                                                                "departments.name",
                                                            ],
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "certification_type",
                                                    "query": {
                                                        "query_string": {
                                                            "query": '"math"',
                                                            "fields": [
                                                                "certification_type.name.english^5"
                                                            ],
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "course.course_numbers",
                                                    "query": {
                                                        "query_string": {
                                                            "query": '"math"',
                                                            "fields": [
                                                                "course.course_numbers.value^5"
                                                            ],
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "runs",
                                                    "query": {
                                                        "query_string": {
                                                            "query": '"math"',
                                                            "fields": [
                                                                "runs.year",
                                                                "runs.semester",
                                                            ],
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "runs",
                                                    "query": {
                                                        "nested": {
                                                            "path": "runs.instructors",
                                                            "query": {
                                                                "query_string": {
                                                                    "query": '"math"',
                                                                    "fields": [
                                                                        "runs.instructors.last_name^5",
                                                                        "runs.instructors.full_name^5",
                                                                    ],
                                                                }
                                                            },
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "runs",
                                                    "query": {
                                                        "nested": {
                                                            "path": "runs.level",
                                                            "query": {
                                                                "query_string": {
                                                                    "query": '"math"',
                                                                    "fields": [
                                                                        "runs.level.name^5"
                                                                    ],
                                                                }
                                                            },
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "has_child": {
                                                    "type": "content_file",
                                                    "query": {
                                                        "query_string": {
                                                            "query": '"math"',
                                                            "fields": [
                                                                "content.english^0.5",
                                                                "title.english^0.5",
                                                                "content_title.english^0.5",
                                                                "description.english^0.5",
                                                                "content_feature_type^0.5",
                                                            ],
                                                        }
                                                    },
                                                    "score_mode": "avg",
                                                }
                                            },
                                        ]
                                    }
                                },
                                "min_score": 10,
                            }
                        }
                    ]
                }
            },
            "should": [
                {
                    "query_string": {
                        "query": '"math"',
                        "fields": [
                            "title.english^3",
                            "description.english^2",
                            "full_description.english",
                            "platform.name",
                            "readable_id",
                            "offered_by",
                            "course_feature",
                            "video.transcript.english",
                        ],
                    }
                },
                {
                    "nested": {
                        "path": "topics",
                        "query": {
                            "query_string": {
                                "query": '"math"',
                                "fields": ["topics.name"],
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "departments",
                        "query": {
                            "query_string": {
                                "query": '"math"',
                                "fields": [
                                    "departments.department_id",
                                    "departments.name",
                                ],
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "certification_type",
                        "query": {
                            "query_string": {
                                "query": '"math"',
                                "fields": ["certification_type.name.english^5"],
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "course.course_numbers",
                        "query": {
                            "query_string": {
                                "query": '"math"',
                                "fields": ["course.course_numbers.value^5"],
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "runs",
                        "query": {
                            "query_string": {
                                "query": '"math"',
                                "fields": ["runs.year", "runs.semester"],
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "runs",
                        "query": {
                            "nested": {
                                "path": "runs.instructors",
                                "query": {
                                    "query_string": {
                                        "query": '"math"',
                                        "fields": [
                                            "runs.instructors.last_name^5",
                                            "runs.instructors.full_name^5",
                                        ],
                                    }
                                },
                            }
                        },
                    }
                },
                {
                    "nested": {
                        "path": "runs",
                        "query": {
                            "nested": {
                                "path": "runs.level",
                                "query": {
                                    "query_string": {
                                        "query": '"math"',
                                        "fields": ["runs.level.name^5"],
                                    }
                                },
                            }
                        },
                    }
                },
                {
                    "has_child": {
                        "type": "content_file",
                        "query": {
                            "query_string": {
                                "query": '"math"',
                                "fields": [
                                    "content.english^0.5",
                                    "title.english^0.5",
                                    "content_title.english^0.5",
                                    "description.english^0.5",
                                    "content_feature_type^0.5",
                                ],
                            }
                        },
                        "score_mode": "avg",
                    }
                },
            ],
        }
    }

    assert (
        generate_learning_resources_text_clause(
            "math", search_mode, slop, content_file_score_weight, min_score
        )
        == result1
    )
    assert (
        generate_learning_resources_text_clause(
            '"math"', search_mode, slop, content_file_score_weight, min_score
        )
        == result2
    )


def test_generate_content_file_text_clause():
    result1 = {
        "bool": {
            "filter": {
                "bool": {
                    "must": [
                        {
                            "bool": {
                                "should": [
                                    {
                                        "multi_match": {
                                            "query": "math",
                                            "fields": [
                                                "content.english",
                                                "title.english",
                                                "content_title.english",
                                                "description.english",
                                                "content_feature_type",
                                            ],
                                        }
                                    },
                                    {
                                        "nested": {
                                            "path": "departments",
                                            "query": {
                                                "multi_match": {
                                                    "query": "math",
                                                    "fields": [
                                                        "departments.department_id",
                                                        "departments.name",
                                                    ],
                                                }
                                            },
                                        }
                                    },
                                ]
                            }
                        }
                    ]
                }
            },
            "should": [
                {
                    "multi_match": {
                        "query": "math",
                        "fields": [
                            "content.english",
                            "title.english",
                            "content_title.english",
                            "description.english",
                            "content_feature_type",
                        ],
                    }
                },
                {
                    "nested": {
                        "path": "departments",
                        "query": {
                            "multi_match": {
                                "query": "math",
                                "fields": [
                                    "departments.department_id",
                                    "departments.name",
                                ],
                            }
                        },
                    }
                },
            ],
        }
    }
    result2 = {
        "bool": {
            "filter": {
                "bool": {
                    "must": [
                        {
                            "bool": {
                                "should": [
                                    {
                                        "query_string": {
                                            "query": '"math"',
                                            "fields": [
                                                "content.english",
                                                "title.english",
                                                "content_title.english",
                                                "description.english",
                                                "content_feature_type",
                                            ],
                                        }
                                    },
                                    {
                                        "nested": {
                                            "path": "departments",
                                            "query": {
                                                "query_string": {
                                                    "query": '"math"',
                                                    "fields": [
                                                        "departments.department_id",
                                                        "departments.name",
                                                    ],
                                                }
                                            },
                                        }
                                    },
                                ]
                            }
                        }
                    ]
                }
            },
            "should": [
                {
                    "query_string": {
                        "query": '"math"',
                        "fields": [
                            "content.english",
                            "title.english",
                            "content_title.english",
                            "description.english",
                            "content_feature_type",
                        ],
                    }
                },
                {
                    "nested": {
                        "path": "departments",
                        "query": {
                            "query_string": {
                                "query": '"math"',
                                "fields": [
                                    "departments.department_id",
                                    "departments.name",
                                ],
                            }
                        },
                    }
                },
            ],
        }
    }
    assert generate_content_file_text_clause("math") == result1
    assert generate_content_file_text_clause('"math"') == result2


def test_generate_suggest_clause():
    result = {
        "text": "math",
        "title.trigram": {
            "phrase": {
                "field": "title.trigram",
                "size": 5,
                "gram_size": 1,
                "confidence": 0.0001,
                "max_errors": 3,
                "collate": {
                    "query": {
                        "source": {"match_phrase": {"{{field_name}}": "{{suggestion}}"}}
                    },
                    "params": {"field_name": "title.trigram"},
                    "prune": True,
                },
            }
        },
        "description.trigram": {
            "phrase": {
                "field": "description.trigram",
                "size": 5,
                "gram_size": 1,
                "confidence": 0.0001,
                "max_errors": 3,
                "collate": {
                    "query": {
                        "source": {"match_phrase": {"{{field_name}}": "{{suggestion}}"}}
                    },
                    "params": {"field_name": "description.trigram"},
                    "prune": True,
                },
            }
        },
    }
    assert generate_suggest_clause("math") == result


@pytest.mark.parametrize("case_sensitive", [False, True])
def test_generate_filter_clause_not_nested(case_sensitive):
    case_sensitivity = {} if case_sensitive else {"case_insensitive": True}
    assert generate_filter_clause("a", "some-value", case_sensitive=case_sensitive) == {
        "term": {"a": {"value": "some-value", **case_sensitivity}}
    }


@pytest.mark.parametrize("case_sensitive", [False, True])
def test_generate_filter_clause_with_nesting(case_sensitive):
    case_sensitivity = {} if case_sensitive else {"case_insensitive": True}
    assert generate_filter_clause(
        "a.b.c.d", "some-value", case_sensitive=case_sensitive
    ) == {
        "nested": {
            "path": "a",
            "query": {
                "nested": {
                    "path": "a.b",
                    "query": {
                        "nested": {
                            "path": "a.b.c",
                            "query": {
                                "term": {
                                    "a.b.c.d": {
                                        "value": "some-value",
                                        **case_sensitivity,
                                    }
                                }
                            },
                        }
                    },
                }
            },
        }
    }


def test_generate_filter_clauses():
    query = {"offered_by": ["ocw", "xpro"], "level": ["Undergraduate"]}
    result = {
        "level": {
            "bool": {
                "should": [
                    {
                        "nested": {
                            "path": "runs",
                            "query": {
                                "nested": {
                                    "path": "runs.level",
                                    "query": {
                                        "term": {
                                            "runs.level.code": {
                                                "case_insensitive": True,
                                                "value": "Undergraduate",
                                            }
                                        }
                                    },
                                }
                            },
                        }
                    }
                ]
            }
        },
        "offered_by": {
            "bool": {
                "should": [
                    {
                        "nested": {
                            "path": "offered_by",
                            "query": {
                                "term": {
                                    "offered_by.code": {
                                        "case_insensitive": True,
                                        "value": "ocw",
                                    }
                                }
                            },
                        }
                    },
                    {
                        "nested": {
                            "path": "offered_by",
                            "query": {
                                "term": {
                                    "offered_by.code": {
                                        "case_insensitive": True,
                                        "value": "xpro",
                                    }
                                }
                            },
                        }
                    },
                ]
            }
        },
    }
    assert generate_filter_clauses(query) == result


def test_generate_aggregation_clauses_when_there_is_no_filter():
    params = {"aggregations": ["offered_by", "level"]}
    result = {
        "offered_by": {
            "aggs": {
                "offered_by": {
                    "terms": {"field": "offered_by.code", "size": 10000},
                    "aggs": {"root": {"reverse_nested": {}}},
                }
            },
            "nested": {"path": "offered_by"},
        },
        "level": {
            "nested": {"path": "runs"},
            "aggs": {
                "level": {
                    "nested": {"path": "runs.level"},
                    "aggs": {
                        "level": {
                            "terms": {"field": "runs.level.code", "size": 10000},
                            "aggs": {"root": {"reverse_nested": {}}},
                        }
                    },
                }
            },
        },
    }
    assert generate_aggregation_clauses(params, {}) == result


def test_generate_aggregation_clause_single_not_nested():
    assert generate_aggregation_clause("agg_a", "a") == {
        "terms": {"field": "a", "size": 10000}
    }


def test_generate_aggregation_clause_single_nested():
    assert generate_aggregation_clause("some_name", "a.b.c") == {
        "nested": {"path": "a"},
        "aggs": {
            "some_name": {
                "nested": {"path": "a.b"},
                "aggs": {
                    "some_name": {
                        "terms": {"field": "a.b.c", "size": 10000},
                        "aggs": {"root": {"reverse_nested": {}}},
                    }
                },
            }
        },
    }


def test_generate_aggregation_clauses_with_filter():
    params = {"aggregations": ["offered_by", "level"]}
    filters = {"platform": "the filter"}
    result = {
        "offered_by": {
            "aggs": {
                "offered_by": {
                    "aggs": {
                        "offered_by": {
                            "terms": {"field": "offered_by.code", "size": 10000},
                            "aggs": {"root": {"reverse_nested": {}}},
                        }
                    },
                    "nested": {"path": "offered_by"},
                }
            },
            "filter": {"bool": {"must": ["the filter"]}},
        },
        "level": {
            "aggs": {
                "level": {
                    "nested": {"path": "runs"},
                    "aggs": {
                        "level": {
                            "nested": {"path": "runs.level"},
                            "aggs": {
                                "level": {
                                    "terms": {
                                        "field": "runs.level.code",
                                        "size": 10000,
                                    },
                                    "aggs": {"root": {"reverse_nested": {}}},
                                }
                            },
                        }
                    },
                }
            },
            "filter": {"bool": {"must": ["the filter"]}},
        },
    }
    assert generate_aggregation_clauses(params, filters) == result


def test_generate_aggregation_clauses_with_same_filters_as_aggregation():
    params = {"aggregations": ["offered_by", "level"]}
    filters = {
        "platform": "platform filter",
        "offered_by": "offered_by filter",
        "level": "level filter",
    }
    result = {
        "level": {
            "aggs": {
                "level": {
                    "aggs": {
                        "level": {
                            "aggs": {
                                "level": {
                                    "terms": {
                                        "field": "runs.level.code",
                                        "size": 10000,
                                    },
                                    "aggs": {"root": {"reverse_nested": {}}},
                                },
                            },
                            "nested": {"path": "runs.level"},
                        }
                    },
                    "nested": {"path": "runs"},
                }
            },
            "filter": {"bool": {"must": ["platform filter", "offered_by filter"]}},
        },
        "offered_by": {
            "aggs": {
                "offered_by": {
                    "aggs": {
                        "offered_by": {
                            "terms": {"field": "offered_by.code", "size": 10000},
                            "aggs": {"root": {"reverse_nested": {}}},
                        }
                    },
                    "nested": {"path": "offered_by"},
                }
            },
            "filter": {"bool": {"must": ["platform filter", "level filter"]}},
        },
    }
    assert generate_aggregation_clauses(params, filters) == result


def test_execute_learn_search_for_learning_resource_query(opensearch):
    opensearch.conn.search.return_value = {
        "hits": {"total": {"value": 10, "relation": "eq"}}
    }
    search_params = {
        "aggregations": ["offered_by"],
        "q": "math",
        "resource_type": ["course"],
        "free": [True],
        "limit": 1,
        "offset": 1,
        "sortby": "-readable_id",
        "endpoint": LEARNING_RESOURCE,
        "yearly_decay_percent": 0,
        "max_incompleteness_penalty": 0,
        "min_score": 0,
        "search_mode": "best_fields",
    }

    query = {
        "query": {
            "bool": {
                "must": [
                    {
                        "bool": {
                            "filter": [
                                {
                                    "bool": {
                                        "must": [
                                            {
                                                "bool": {
                                                    "should": [
                                                        {
                                                            "multi_match": {
                                                                "query": "math",
                                                                "fields": [
                                                                    "title.english^3",
                                                                    "description.english^2",
                                                                    "full_description.english",
                                                                    "platform.name",
                                                                    "readable_id",
                                                                    "offered_by",
                                                                    "course_feature",
                                                                    "video.transcript.english",
                                                                ],
                                                                "type": "best_fields",
                                                            }
                                                        },
                                                        {
                                                            "nested": {
                                                                "path": "topics",
                                                                "query": {
                                                                    "multi_match": {
                                                                        "query": "math",
                                                                        "fields": [
                                                                            "topics.name"
                                                                        ],
                                                                        "type": "best_fields",
                                                                    }
                                                                },
                                                            }
                                                        },
                                                        {
                                                            "nested": {
                                                                "path": "departments",
                                                                "query": {
                                                                    "multi_match": {
                                                                        "query": "math",
                                                                        "fields": [
                                                                            "departments.department_id",
                                                                            "departments.name",
                                                                        ],
                                                                        "type": "best_fields",
                                                                    }
                                                                },
                                                            }
                                                        },
                                                        {
                                                            "nested": {
                                                                "path": "certification_type",
                                                                "query": {
                                                                    "multi_match": {
                                                                        "query": "math",
                                                                        "fields": [
                                                                            "certification_type.name.english^5"
                                                                        ],
                                                                        "type": "best_fields",
                                                                    }
                                                                },
                                                            }
                                                        },
                                                        {
                                                            "nested": {
                                                                "path": "course.course_numbers",
                                                                "query": {
                                                                    "multi_match": {
                                                                        "query": "math",
                                                                        "fields": [
                                                                            "course.course_numbers.value^5"
                                                                        ],
                                                                        "type": "best_fields",
                                                                    }
                                                                },
                                                            }
                                                        },
                                                        {
                                                            "nested": {
                                                                "path": "runs",
                                                                "query": {
                                                                    "multi_match": {
                                                                        "query": "math",
                                                                        "fields": [
                                                                            "runs.year",
                                                                            "runs.semester",
                                                                        ],
                                                                        "type": "best_fields",
                                                                    }
                                                                },
                                                            }
                                                        },
                                                        {
                                                            "nested": {
                                                                "path": "runs",
                                                                "query": {
                                                                    "nested": {
                                                                        "path": "runs.instructors",
                                                                        "query": {
                                                                            "multi_match": {
                                                                                "query": "math",
                                                                                "fields": [
                                                                                    "runs.instructors.last_name^5",
                                                                                    "runs.instructors.full_name^5",
                                                                                ],
                                                                                "type": "best_fields",
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                            }
                                                        },
                                                        {
                                                            "nested": {
                                                                "path": "runs",
                                                                "query": {
                                                                    "nested": {
                                                                        "path": "runs.level",
                                                                        "query": {
                                                                            "multi_match": {
                                                                                "query": "math",
                                                                                "fields": [
                                                                                    "runs.level.name^5"
                                                                                ],
                                                                                "type": "best_fields",
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                            }
                                                        },
                                                        {
                                                            "has_child": {
                                                                "type": "content_file",
                                                                "query": {
                                                                    "multi_match": {
                                                                        "query": "math",
                                                                        "fields": [
                                                                            "content.english",
                                                                            "title.english",
                                                                            "content_title.english",
                                                                            "description.english",
                                                                            "content_feature_type",
                                                                        ],
                                                                        "type": "best_fields",
                                                                    }
                                                                },
                                                                "score_mode": "avg",
                                                            }
                                                        },
                                                    ]
                                                }
                                            }
                                        ]
                                    }
                                }
                            ],
                            "should": [
                                {
                                    "multi_match": {
                                        "query": "math",
                                        "fields": [
                                            "title.english^3",
                                            "description.english^2",
                                            "full_description.english",
                                            "platform.name",
                                            "readable_id",
                                            "offered_by",
                                            "course_feature",
                                            "video.transcript.english",
                                        ],
                                        "type": "best_fields",
                                    }
                                },
                                {
                                    "nested": {
                                        "path": "topics",
                                        "query": {
                                            "multi_match": {
                                                "query": "math",
                                                "fields": ["topics.name"],
                                                "type": "best_fields",
                                            }
                                        },
                                    }
                                },
                                {
                                    "nested": {
                                        "path": "departments",
                                        "query": {
                                            "multi_match": {
                                                "query": "math",
                                                "fields": [
                                                    "departments.department_id",
                                                    "departments.name",
                                                ],
                                                "type": "best_fields",
                                            }
                                        },
                                    }
                                },
                                {
                                    "nested": {
                                        "path": "certification_type",
                                        "query": {
                                            "multi_match": {
                                                "query": "math",
                                                "fields": [
                                                    "certification_type.name.english^5"
                                                ],
                                                "type": "best_fields",
                                            }
                                        },
                                    }
                                },
                                {
                                    "nested": {
                                        "path": "course.course_numbers",
                                        "query": {
                                            "multi_match": {
                                                "query": "math",
                                                "fields": [
                                                    "course.course_numbers.value^5"
                                                ],
                                                "type": "best_fields",
                                            }
                                        },
                                    }
                                },
                                {
                                    "nested": {
                                        "path": "runs",
                                        "query": {
                                            "multi_match": {
                                                "query": "math",
                                                "fields": [
                                                    "runs.year",
                                                    "runs.semester",
                                                ],
                                                "type": "best_fields",
                                            }
                                        },
                                    }
                                },
                                {
                                    "nested": {
                                        "path": "runs",
                                        "query": {
                                            "nested": {
                                                "path": "runs.instructors",
                                                "query": {
                                                    "multi_match": {
                                                        "query": "math",
                                                        "fields": [
                                                            "runs.instructors.last_name^5",
                                                            "runs.instructors.full_name^5",
                                                        ],
                                                        "type": "best_fields",
                                                    }
                                                },
                                            }
                                        },
                                    }
                                },
                                {
                                    "nested": {
                                        "path": "runs",
                                        "query": {
                                            "nested": {
                                                "path": "runs.level",
                                                "query": {
                                                    "multi_match": {
                                                        "query": "math",
                                                        "fields": ["runs.level.name^5"],
                                                        "type": "best_fields",
                                                    }
                                                },
                                            }
                                        },
                                    }
                                },
                                {
                                    "has_child": {
                                        "type": "content_file",
                                        "query": {
                                            "multi_match": {
                                                "query": "math",
                                                "fields": [
                                                    "content.english",
                                                    "title.english",
                                                    "content_title.english",
                                                    "description.english",
                                                    "content_feature_type",
                                                ],
                                                "type": "best_fields",
                                            }
                                        },
                                        "score_mode": "avg",
                                    }
                                },
                            ],
                        }
                    }
                ],
                "filter": [{"exists": {"field": "resource_type"}}],
            }
        },
        "post_filter": {
            "bool": {
                "must": [
                    {
                        "bool": {
                            "should": [
                                {
                                    "term": {
                                        "resource_type": {
                                            "value": "course",
                                            "case_insensitive": True,
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "bool": {
                            "should": [
                                {
                                    "term": {
                                        "free": {
                                            "value": True,
                                            "case_insensitive": True,
                                        }
                                    }
                                }
                            ]
                        }
                    },
                ]
            }
        },
        "sort": [{"readable_id": {"order": "desc"}}],
        "from": 1,
        "size": 1,
        "aggs": {
            "offered_by": {
                "aggs": {
                    "offered_by": {
                        "nested": {"path": "offered_by"},
                        "aggs": {
                            "offered_by": {
                                "terms": {"field": "offered_by.code", "size": 10000},
                                "aggs": {"root": {"reverse_nested": {}}},
                            }
                        },
                    }
                },
                "filter": {
                    "bool": {
                        "must": [
                            {
                                "bool": {
                                    "should": [
                                        {
                                            "term": {
                                                "resource_type": {
                                                    "value": "course",
                                                    "case_insensitive": True,
                                                }
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                "bool": {
                                    "should": [
                                        {
                                            "term": {
                                                "free": {
                                                    "value": True,
                                                    "case_insensitive": True,
                                                }
                                            }
                                        }
                                    ]
                                }
                            },
                        ]
                    }
                },
            }
        },
        "_source": {
            "excludes": [
                "created_on",
                "course.course_numbers.sort_coursenum",
                "course.course_numbers.primary",
                "resource_relations",
                "is_learning_material",
                "resource_age_date",
                "featured_rank",
                "is_incomplete_or_stale",
                "content",
                "summary",
                "flashcards",
                "vector_embedding",
            ]
        },
    }
    assert execute_learn_search(search_params) == opensearch.conn.search.return_value

    opensearch.conn.search.assert_called_once_with(
        body=query,
        index=["testindex_course_default"],
    )


@freeze_time("2024-07-20")
@pytest.mark.parametrize(
    ("yearly_decay_percent", "max_incompleteness_penalty"),
    [
        (5, 25),
        (0, 25),
        (5, 0),
    ],
)
def test_execute_learn_search_with_script_score(
    mocker, settings, opensearch, yearly_decay_percent, max_incompleteness_penalty
):
    settings.DEFAULT_SEARCH_MODE = "phrase"
    settings.DEFAULT_SEARCH_SLOP = 0
    settings.DEFAULT_SEARCH_MINIMUM_SCORE_CUTOFF = 0

    opensearch.conn.search.return_value = {
        "hits": {"total": {"value": 10, "relation": "eq"}}
    }

    if yearly_decay_percent > 0 and max_incompleteness_penalty > 0:
        source = (
            "(doc['completeness'].value * params.max_incompleteness_penalty + "
            "(1-params.max_incompleteness_penalty))*(doc['resource_age_date'].size() == 0 ? "
            "1 : decayDateLinear(params.origin, params.scale, params.offset, params.decay, "
            "doc['resource_age_date'].value))"
        )
        params = {
            "origin": "2024-07-20T00:00:00.000000Z",
            "offset": "0",
            "scale": "365d",
            "decay": 0.95,
            "max_incompleteness_penalty": 0.25,
        }
    elif yearly_decay_percent > 0:
        source = (
            "(doc['resource_age_date'].size() == 0 ? "
            "1 : decayDateLinear(params.origin, params.scale, params.offset, params.decay, "
            "doc['resource_age_date'].value))"
        )

        params = {
            "origin": "2024-07-20T00:00:00.000000Z",
            "offset": "0",
            "scale": "365d",
            "decay": 0.95,
        }
    else:
        source = (
            "(doc['completeness'].value * params.max_incompleteness_penalty +"
            " (1-params.max_incompleteness_penalty))"
        )
        params = {"max_incompleteness_penalty": 0.25}

    search_params = {
        "aggregations": ["offered_by"],
        "q": "math",
        "resource_type": ["course"],
        "free": [True],
        "limit": 1,
        "offset": 1,
        "sortby": "-readable_id",
        "endpoint": LEARNING_RESOURCE,
        "yearly_decay_percent": yearly_decay_percent,
        "max_incompleteness_penalty": max_incompleteness_penalty,
    }

    query = {
        "query": {
            "function_score": {
                "query": {
                    "bool": {
                        "must": [
                            {
                                "bool": {
                                    "filter": [
                                        {
                                            "bool": {
                                                "must": [
                                                    {
                                                        "bool": {
                                                            "should": [
                                                                {
                                                                    "multi_match": {
                                                                        "query": "math",
                                                                        "fields": [
                                                                            "title.english^3",
                                                                            "description.english^2",
                                                                            "full_description.english",
                                                                            "platform.name",
                                                                            "readable_id",
                                                                            "offered_by",
                                                                            "course_feature",
                                                                            "video.transcript.english",
                                                                        ],
                                                                        "type": "phrase",
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "topics",
                                                                        "query": {
                                                                            "multi_match": {
                                                                                "query": "math",
                                                                                "fields": [
                                                                                    "topics.name"
                                                                                ],
                                                                                "type": "phrase",
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "departments",
                                                                        "query": {
                                                                            "multi_match": {
                                                                                "query": "math",
                                                                                "fields": [
                                                                                    "departments.department_id",
                                                                                    "departments.name",
                                                                                ],
                                                                                "type": "phrase",
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "certification_type",
                                                                        "query": {
                                                                            "multi_match": {
                                                                                "query": "math",
                                                                                "fields": [
                                                                                    "certification_type.name.english^5"
                                                                                ],
                                                                                "type": "phrase",
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "course.course_numbers",
                                                                        "query": {
                                                                            "multi_match": {
                                                                                "query": "math",
                                                                                "fields": [
                                                                                    "course.course_numbers.value^5"
                                                                                ],
                                                                                "type": "phrase",
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "runs",
                                                                        "query": {
                                                                            "multi_match": {
                                                                                "query": "math",
                                                                                "fields": [
                                                                                    "runs.year",
                                                                                    "runs.semester",
                                                                                ],
                                                                                "type": "phrase",
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "runs",
                                                                        "query": {
                                                                            "nested": {
                                                                                "path": "runs.instructors",
                                                                                "query": {
                                                                                    "multi_match": {
                                                                                        "query": "math",
                                                                                        "fields": [
                                                                                            "runs.instructors.last_name^5",
                                                                                            "runs.instructors.full_name^5",
                                                                                        ],
                                                                                        "type": "phrase",
                                                                                    }
                                                                                },
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "runs",
                                                                        "query": {
                                                                            "nested": {
                                                                                "path": "runs.level",
                                                                                "query": {
                                                                                    "multi_match": {
                                                                                        "query": "math",
                                                                                        "fields": [
                                                                                            "runs.level.name^5"
                                                                                        ],
                                                                                        "type": "phrase",
                                                                                    }
                                                                                },
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "has_child": {
                                                                        "type": "content_file",
                                                                        "query": {
                                                                            "multi_match": {
                                                                                "query": "math",
                                                                                "fields": [
                                                                                    "content.english",
                                                                                    "title.english",
                                                                                    "content_title.english",
                                                                                    "description.english",
                                                                                    "content_feature_type",
                                                                                ],
                                                                                "type": "phrase",
                                                                            }
                                                                        },
                                                                        "score_mode": "avg",
                                                                    }
                                                                },
                                                            ]
                                                        }
                                                    }
                                                ]
                                            }
                                        }
                                    ],
                                    "should": [
                                        {
                                            "multi_match": {
                                                "query": "math",
                                                "fields": [
                                                    "title.english^3",
                                                    "description.english^2",
                                                    "full_description.english",
                                                    "platform.name",
                                                    "readable_id",
                                                    "offered_by",
                                                    "course_feature",
                                                    "video.transcript.english",
                                                ],
                                                "type": "phrase",
                                            }
                                        },
                                        {
                                            "nested": {
                                                "path": "topics",
                                                "query": {
                                                    "multi_match": {
                                                        "query": "math",
                                                        "fields": ["topics.name"],
                                                        "type": "phrase",
                                                    }
                                                },
                                            }
                                        },
                                        {
                                            "nested": {
                                                "path": "departments",
                                                "query": {
                                                    "multi_match": {
                                                        "query": "math",
                                                        "fields": [
                                                            "departments.department_id",
                                                            "departments.name",
                                                        ],
                                                        "type": "phrase",
                                                    }
                                                },
                                            }
                                        },
                                        {
                                            "nested": {
                                                "path": "certification_type",
                                                "query": {
                                                    "multi_match": {
                                                        "query": "math",
                                                        "fields": [
                                                            "certification_type.name.english^5"
                                                        ],
                                                        "type": "phrase",
                                                    }
                                                },
                                            }
                                        },
                                        {
                                            "nested": {
                                                "path": "course.course_numbers",
                                                "query": {
                                                    "multi_match": {
                                                        "query": "math",
                                                        "fields": [
                                                            "course.course_numbers.value^5"
                                                        ],
                                                        "type": "phrase",
                                                    }
                                                },
                                            }
                                        },
                                        {
                                            "nested": {
                                                "path": "runs",
                                                "query": {
                                                    "multi_match": {
                                                        "query": "math",
                                                        "fields": [
                                                            "runs.year",
                                                            "runs.semester",
                                                        ],
                                                        "type": "phrase",
                                                    }
                                                },
                                            }
                                        },
                                        {
                                            "nested": {
                                                "path": "runs",
                                                "query": {
                                                    "nested": {
                                                        "path": "runs.instructors",
                                                        "query": {
                                                            "multi_match": {
                                                                "query": "math",
                                                                "fields": [
                                                                    "runs.instructors.last_name^5",
                                                                    "runs.instructors.full_name^5",
                                                                ],
                                                                "type": "phrase",
                                                            }
                                                        },
                                                    }
                                                },
                                            }
                                        },
                                        {
                                            "nested": {
                                                "path": "runs",
                                                "query": {
                                                    "nested": {
                                                        "path": "runs.level",
                                                        "query": {
                                                            "multi_match": {
                                                                "query": "math",
                                                                "fields": [
                                                                    "runs.level.name^5"
                                                                ],
                                                                "type": "phrase",
                                                            }
                                                        },
                                                    }
                                                },
                                            }
                                        },
                                        {
                                            "has_child": {
                                                "type": "content_file",
                                                "query": {
                                                    "multi_match": {
                                                        "query": "math",
                                                        "fields": [
                                                            "content.english",
                                                            "title.english",
                                                            "content_title.english",
                                                            "description.english",
                                                            "content_feature_type",
                                                        ],
                                                        "type": "phrase",
                                                    }
                                                },
                                                "score_mode": "avg",
                                            }
                                        },
                                    ],
                                }
                            }
                        ],
                        "filter": [{"exists": {"field": "resource_type"}}],
                    }
                },
                "functions": [
                    {
                        "script_score": {
                            "script": {
                                "source": source,
                                "params": params,
                            }
                        }
                    }
                ],
            }
        },
        "post_filter": {
            "bool": {
                "must": [
                    {
                        "bool": {
                            "should": [
                                {
                                    "term": {
                                        "resource_type": {
                                            "value": "course",
                                            "case_insensitive": True,
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "bool": {
                            "should": [
                                {
                                    "term": {
                                        "free": {
                                            "value": True,
                                            "case_insensitive": True,
                                        }
                                    }
                                }
                            ]
                        }
                    },
                ]
            }
        },
        "sort": [{"readable_id": {"order": "desc"}}],
        "from": 1,
        "size": 1,
        "aggs": {
            "offered_by": {
                "aggs": {
                    "offered_by": {
                        "nested": {"path": "offered_by"},
                        "aggs": {
                            "offered_by": {
                                "terms": {"field": "offered_by.code", "size": 10000},
                                "aggs": {"root": {"reverse_nested": {}}},
                            }
                        },
                    }
                },
                "filter": {
                    "bool": {
                        "must": [
                            {
                                "bool": {
                                    "should": [
                                        {
                                            "term": {
                                                "resource_type": {
                                                    "value": "course",
                                                    "case_insensitive": True,
                                                }
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                "bool": {
                                    "should": [
                                        {
                                            "term": {
                                                "free": {
                                                    "value": True,
                                                    "case_insensitive": True,
                                                }
                                            }
                                        }
                                    ]
                                }
                            },
                        ]
                    }
                },
            }
        },
        "_source": {
            "excludes": [
                "created_on",
                "course.course_numbers.sort_coursenum",
                "course.course_numbers.primary",
                "resource_relations",
                "is_learning_material",
                "resource_age_date",
                "featured_rank",
                "is_incomplete_or_stale",
                "content",
                "summary",
                "flashcards",
                "vector_embedding",
            ]
        },
    }

    assert execute_learn_search(search_params) == opensearch.conn.search.return_value

    opensearch.conn.search.assert_called_once_with(
        body=query,
        index=["testindex_course_default"],
    )


def test_execute_learn_search_with_hybrid_search(mocker, settings, opensearch):
    opensearch.conn.search.return_value = {
        "hits": {"total": {"value": 10, "relation": "eq"}}
    }

    settings.DEFAULT_SEARCH_MODE = "best_fields"
    settings.QDRANT_DENSE_MODEL = "text-embedding-3-small"

    mocker.patch(
        "learning_resources_search.api.get_vector_model_id",
        return_value="vector_model_id",
    )

    search_params = {
        "aggregations": ["offered_by"],
        "q": "math",
        "resource_type": ["course"],
        "free": [True],
        "limit": 1,
        "offset": 1,
        "sortby": "-readable_id",
        "endpoint": LEARNING_RESOURCE,
        "search_mode": "hybrid",
    }

    query = {
        "post_filter": {
            "bool": {
                "must": [
                    {
                        "bool": {
                            "should": [
                                {
                                    "term": {
                                        "resource_type": {
                                            "value": "course",
                                            "case_insensitive": True,
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "bool": {
                            "should": [
                                {
                                    "term": {
                                        "free": {
                                            "value": True,
                                            "case_insensitive": True,
                                        }
                                    }
                                }
                            ]
                        }
                    },
                ]
            }
        },
        "sort": [{"readable_id": {"order": "desc"}}],
        "from": 1,
        "size": 1,
        "query": {
            "hybrid": {
                "pagination_depth": 3,
                "queries": [
                    {
                        "bool": {
                            "must": [
                                {
                                    "bool": {
                                        "filter": {
                                            "bool": {
                                                "must": [
                                                    {
                                                        "bool": {
                                                            "should": [
                                                                {
                                                                    "multi_match": {
                                                                        "query": "math",
                                                                        "fields": [
                                                                            "title.english^3",
                                                                            "description.english^2",
                                                                            "full_description.english",
                                                                            "platform.name",
                                                                            "readable_id",
                                                                            "offered_by",
                                                                            "course_feature",
                                                                            "video.transcript.english",
                                                                        ],
                                                                        "type": "best_fields",
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "topics",
                                                                        "query": {
                                                                            "multi_match": {
                                                                                "query": "math",
                                                                                "fields": [
                                                                                    "topics.name"
                                                                                ],
                                                                                "type": "best_fields",
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "departments",
                                                                        "query": {
                                                                            "multi_match": {
                                                                                "query": "math",
                                                                                "fields": [
                                                                                    "departments.department_id",
                                                                                    "departments.name",
                                                                                ],
                                                                                "type": "best_fields",
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "certification_type",
                                                                        "query": {
                                                                            "multi_match": {
                                                                                "query": "math",
                                                                                "fields": [
                                                                                    "certification_type.name.english^5"
                                                                                ],
                                                                                "type": "best_fields",
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "course.course_numbers",
                                                                        "query": {
                                                                            "multi_match": {
                                                                                "query": "math",
                                                                                "fields": [
                                                                                    "course.course_numbers.value^5"
                                                                                ],
                                                                                "type": "best_fields",
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "runs",
                                                                        "query": {
                                                                            "multi_match": {
                                                                                "query": "math",
                                                                                "fields": [
                                                                                    "runs.year",
                                                                                    "runs.semester",
                                                                                ],
                                                                                "type": "best_fields",
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "runs",
                                                                        "query": {
                                                                            "nested": {
                                                                                "path": "runs.instructors",
                                                                                "query": {
                                                                                    "multi_match": {
                                                                                        "query": "math",
                                                                                        "fields": [
                                                                                            "runs.instructors.last_name^5",
                                                                                            "runs.instructors.full_name^5",
                                                                                        ],
                                                                                        "type": "best_fields",
                                                                                    }
                                                                                },
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "runs",
                                                                        "query": {
                                                                            "nested": {
                                                                                "path": "runs.level",
                                                                                "query": {
                                                                                    "multi_match": {
                                                                                        "query": "math",
                                                                                        "fields": [
                                                                                            "runs.level.name^5"
                                                                                        ],
                                                                                        "type": "best_fields",
                                                                                    }
                                                                                },
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "has_child": {
                                                                        "type": "content_file",
                                                                        "query": {
                                                                            "multi_match": {
                                                                                "query": "math",
                                                                                "fields": [
                                                                                    "content.english",
                                                                                    "title.english",
                                                                                    "content_title.english",
                                                                                    "description.english",
                                                                                    "content_feature_type",
                                                                                ],
                                                                                "type": "best_fields",
                                                                            }
                                                                        },
                                                                        "score_mode": "avg",
                                                                    }
                                                                },
                                                            ]
                                                        }
                                                    }
                                                ]
                                            }
                                        },
                                        "should": [
                                            {
                                                "multi_match": {
                                                    "query": "math",
                                                    "fields": [
                                                        "title.english^3",
                                                        "description.english^2",
                                                        "full_description.english",
                                                        "platform.name",
                                                        "readable_id",
                                                        "offered_by",
                                                        "course_feature",
                                                        "video.transcript.english",
                                                    ],
                                                    "type": "best_fields",
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "topics",
                                                    "query": {
                                                        "multi_match": {
                                                            "query": "math",
                                                            "fields": ["topics.name"],
                                                            "type": "best_fields",
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "departments",
                                                    "query": {
                                                        "multi_match": {
                                                            "query": "math",
                                                            "fields": [
                                                                "departments.department_id",
                                                                "departments.name",
                                                            ],
                                                            "type": "best_fields",
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "certification_type",
                                                    "query": {
                                                        "multi_match": {
                                                            "query": "math",
                                                            "fields": [
                                                                "certification_type.name.english^5"
                                                            ],
                                                            "type": "best_fields",
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "course.course_numbers",
                                                    "query": {
                                                        "multi_match": {
                                                            "query": "math",
                                                            "fields": [
                                                                "course.course_numbers.value^5"
                                                            ],
                                                            "type": "best_fields",
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "runs",
                                                    "query": {
                                                        "multi_match": {
                                                            "query": "math",
                                                            "fields": [
                                                                "runs.year",
                                                                "runs.semester",
                                                            ],
                                                            "type": "best_fields",
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "runs",
                                                    "query": {
                                                        "nested": {
                                                            "path": "runs.instructors",
                                                            "query": {
                                                                "multi_match": {
                                                                    "query": "math",
                                                                    "fields": [
                                                                        "runs.instructors.last_name^5",
                                                                        "runs.instructors.full_name^5",
                                                                    ],
                                                                    "type": "best_fields",
                                                                }
                                                            },
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "nested": {
                                                    "path": "runs",
                                                    "query": {
                                                        "nested": {
                                                            "path": "runs.level",
                                                            "query": {
                                                                "multi_match": {
                                                                    "query": "math",
                                                                    "fields": [
                                                                        "runs.level.name^5"
                                                                    ],
                                                                    "type": "best_fields",
                                                                }
                                                            },
                                                        }
                                                    },
                                                }
                                            },
                                            {
                                                "has_child": {
                                                    "type": "content_file",
                                                    "query": {
                                                        "multi_match": {
                                                            "query": "math",
                                                            "fields": [
                                                                "content.english",
                                                                "title.english",
                                                                "content_title.english",
                                                                "description.english",
                                                                "content_feature_type",
                                                            ],
                                                            "type": "best_fields",
                                                        }
                                                    },
                                                    "score_mode": "avg",
                                                }
                                            },
                                        ],
                                    }
                                }
                            ],
                            "filter": {"exists": {"field": "resource_type"}},
                        }
                    },
                    {
                        "neural": {
                            "vector_embedding": {
                                "query_text": "math",
                                "model_id": "vector_model_id",
                                "k": 5,
                            }
                        }
                    },
                ],
            }
        },
        "aggs": {
            "offered_by": {
                "aggs": {
                    "offered_by": {
                        "nested": {"path": "offered_by"},
                        "aggs": {
                            "offered_by": {
                                "terms": {"field": "offered_by.code", "size": 10000},
                                "aggs": {"root": {"reverse_nested": {}}},
                            }
                        },
                    }
                },
                "filter": {
                    "bool": {
                        "must": [
                            {
                                "bool": {
                                    "should": [
                                        {
                                            "term": {
                                                "resource_type": {
                                                    "value": "course",
                                                    "case_insensitive": True,
                                                }
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                "bool": {
                                    "should": [
                                        {
                                            "term": {
                                                "free": {
                                                    "value": True,
                                                    "case_insensitive": True,
                                                }
                                            }
                                        }
                                    ]
                                }
                            },
                        ]
                    }
                },
            }
        },
        "search_pipeline": "hybrid_search_pipeline",
        "_source": {
            "excludes": [
                "created_on",
                "course.course_numbers.sort_coursenum",
                "course.course_numbers.primary",
                "resource_relations",
                "is_learning_material",
                "resource_age_date",
                "featured_rank",
                "is_incomplete_or_stale",
                "content",
                "summary",
                "flashcards",
                "vector_embedding",
            ]
        },
    }

    assert execute_learn_search(search_params) == opensearch.conn.search.return_value

    opensearch.conn.search.assert_called_once_with(
        body=query,
        index=["testindex_combined_hybrid_default"],
    )


def test_execute_learn_search_with_min_score(mocker, settings, opensearch):
    opensearch.conn.search.return_value = {
        "hits": {"total": {"value": 10, "relation": "eq"}}
    }

    settings.DEFAULT_SEARCH_MAX_INCOMPLETENESS_PENALTY = 0
    settings.DEFAULT_SEARCH_STALENESS_PENALTY = 0
    settings.DEFAULT_SEARCH_MODE = "best_fields"

    search_params = {
        "aggregations": ["offered_by"],
        "q": "math",
        "resource_type": ["course"],
        "free": [True],
        "limit": 1,
        "offset": 1,
        "sortby": "-readable_id",
        "endpoint": LEARNING_RESOURCE,
        "min_score": 5,
    }

    query = {
        "query": {
            "bool": {
                "must": [
                    {
                        "bool": {
                            "filter": [
                                {
                                    "bool": {
                                        "must": [
                                            {
                                                "function_score": {
                                                    "query": {
                                                        "bool": {
                                                            "should": [
                                                                {
                                                                    "multi_match": {
                                                                        "query": "math",
                                                                        "fields": [
                                                                            "title.english^3",
                                                                            "description.english^2",
                                                                            "full_description.english",
                                                                            "platform.name",
                                                                            "readable_id",
                                                                            "offered_by",
                                                                            "course_feature",
                                                                            "video.transcript.english",
                                                                        ],
                                                                        "type": "best_fields",
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "topics",
                                                                        "query": {
                                                                            "multi_match": {
                                                                                "query": "math",
                                                                                "fields": [
                                                                                    "topics.name"
                                                                                ],
                                                                                "type": "best_fields",
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "departments",
                                                                        "query": {
                                                                            "multi_match": {
                                                                                "query": "math",
                                                                                "fields": [
                                                                                    "departments.department_id",
                                                                                    "departments.name",
                                                                                ],
                                                                                "type": "best_fields",
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "certification_type",
                                                                        "query": {
                                                                            "multi_match": {
                                                                                "query": "math",
                                                                                "fields": [
                                                                                    "certification_type.name.english^5"
                                                                                ],
                                                                                "type": "best_fields",
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "course.course_numbers",
                                                                        "query": {
                                                                            "multi_match": {
                                                                                "query": "math",
                                                                                "fields": [
                                                                                    "course.course_numbers.value^5"
                                                                                ],
                                                                                "type": "best_fields",
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "runs",
                                                                        "query": {
                                                                            "multi_match": {
                                                                                "query": "math",
                                                                                "fields": [
                                                                                    "runs.year",
                                                                                    "runs.semester",
                                                                                ],
                                                                                "type": "best_fields",
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "runs",
                                                                        "query": {
                                                                            "nested": {
                                                                                "path": "runs.instructors",
                                                                                "query": {
                                                                                    "multi_match": {
                                                                                        "query": "math",
                                                                                        "fields": [
                                                                                            "runs.instructors.last_name^5",
                                                                                            "runs.instructors.full_name^5",
                                                                                        ],
                                                                                        "type": "best_fields",
                                                                                    }
                                                                                },
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "nested": {
                                                                        "path": "runs",
                                                                        "query": {
                                                                            "nested": {
                                                                                "path": "runs.level",
                                                                                "query": {
                                                                                    "multi_match": {
                                                                                        "query": "math",
                                                                                        "fields": [
                                                                                            "runs.level.name^5"
                                                                                        ],
                                                                                        "type": "best_fields",
                                                                                    }
                                                                                },
                                                                            }
                                                                        },
                                                                    }
                                                                },
                                                                {
                                                                    "has_child": {
                                                                        "type": "content_file",
                                                                        "query": {
                                                                            "multi_match": {
                                                                                "query": "math",
                                                                                "fields": [
                                                                                    "content.english",
                                                                                    "title.english",
                                                                                    "content_title.english",
                                                                                    "description.english",
                                                                                    "content_feature_type",
                                                                                ],
                                                                                "type": "best_fields",
                                                                            }
                                                                        },
                                                                        "score_mode": "avg",
                                                                    }
                                                                },
                                                            ]
                                                        }
                                                    },
                                                    "min_score": 5,
                                                }
                                            }
                                        ]
                                    }
                                }
                            ],
                            "should": [
                                {
                                    "multi_match": {
                                        "query": "math",
                                        "fields": [
                                            "title.english^3",
                                            "description.english^2",
                                            "full_description.english",
                                            "platform.name",
                                            "readable_id",
                                            "offered_by",
                                            "course_feature",
                                            "video.transcript.english",
                                        ],
                                        "type": "best_fields",
                                    }
                                },
                                {
                                    "nested": {
                                        "path": "topics",
                                        "query": {
                                            "multi_match": {
                                                "query": "math",
                                                "fields": ["topics.name"],
                                                "type": "best_fields",
                                            }
                                        },
                                    }
                                },
                                {
                                    "nested": {
                                        "path": "departments",
                                        "query": {
                                            "multi_match": {
                                                "query": "math",
                                                "fields": [
                                                    "departments.department_id",
                                                    "departments.name",
                                                ],
                                                "type": "best_fields",
                                            }
                                        },
                                    }
                                },
                                {
                                    "nested": {
                                        "path": "certification_type",
                                        "query": {
                                            "multi_match": {
                                                "query": "math",
                                                "fields": [
                                                    "certification_type.name.english^5"
                                                ],
                                                "type": "best_fields",
                                            }
                                        },
                                    }
                                },
                                {
                                    "nested": {
                                        "path": "course.course_numbers",
                                        "query": {
                                            "multi_match": {
                                                "query": "math",
                                                "fields": [
                                                    "course.course_numbers.value^5"
                                                ],
                                                "type": "best_fields",
                                            }
                                        },
                                    }
                                },
                                {
                                    "nested": {
                                        "path": "runs",
                                        "query": {
                                            "multi_match": {
                                                "query": "math",
                                                "fields": [
                                                    "runs.year",
                                                    "runs.semester",
                                                ],
                                                "type": "best_fields",
                                            }
                                        },
                                    }
                                },
                                {
                                    "nested": {
                                        "path": "runs",
                                        "query": {
                                            "nested": {
                                                "path": "runs.instructors",
                                                "query": {
                                                    "multi_match": {
                                                        "query": "math",
                                                        "fields": [
                                                            "runs.instructors.last_name^5",
                                                            "runs.instructors.full_name^5",
                                                        ],
                                                        "type": "best_fields",
                                                    }
                                                },
                                            }
                                        },
                                    }
                                },
                                {
                                    "nested": {
                                        "path": "runs",
                                        "query": {
                                            "nested": {
                                                "path": "runs.level",
                                                "query": {
                                                    "multi_match": {
                                                        "query": "math",
                                                        "fields": ["runs.level.name^5"],
                                                        "type": "best_fields",
                                                    }
                                                },
                                            }
                                        },
                                    }
                                },
                                {
                                    "has_child": {
                                        "type": "content_file",
                                        "query": {
                                            "multi_match": {
                                                "query": "math",
                                                "fields": [
                                                    "content.english",
                                                    "title.english",
                                                    "content_title.english",
                                                    "description.english",
                                                    "content_feature_type",
                                                ],
                                                "type": "best_fields",
                                            }
                                        },
                                        "score_mode": "avg",
                                    }
                                },
                            ],
                        }
                    }
                ],
                "filter": [{"exists": {"field": "resource_type"}}],
            }
        },
        "post_filter": {
            "bool": {
                "must": [
                    {
                        "bool": {
                            "should": [
                                {
                                    "term": {
                                        "resource_type": {
                                            "value": "course",
                                            "case_insensitive": True,
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    {
                        "bool": {
                            "should": [
                                {
                                    "term": {
                                        "free": {
                                            "value": True,
                                            "case_insensitive": True,
                                        }
                                    }
                                }
                            ]
                        }
                    },
                ]
            }
        },
        "sort": [{"readable_id": {"order": "desc"}}],
        "from": 1,
        "size": 1,
        "aggs": {
            "offered_by": {
                "aggs": {
                    "offered_by": {
                        "nested": {"path": "offered_by"},
                        "aggs": {
                            "offered_by": {
                                "terms": {"field": "offered_by.code", "size": 10000},
                                "aggs": {"root": {"reverse_nested": {}}},
                            }
                        },
                    }
                },
                "filter": {
                    "bool": {
                        "must": [
                            {
                                "bool": {
                                    "should": [
                                        {
                                            "term": {
                                                "resource_type": {
                                                    "value": "course",
                                                    "case_insensitive": True,
                                                }
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                "bool": {
                                    "should": [
                                        {
                                            "term": {
                                                "free": {
                                                    "value": True,
                                                    "case_insensitive": True,
                                                }
                                            }
                                        }
                                    ]
                                }
                            },
                        ]
                    }
                },
            }
        },
        "_source": {
            "excludes": [
                "created_on",
                "course.course_numbers.sort_coursenum",
                "course.course_numbers.primary",
                "resource_relations",
                "is_learning_material",
                "resource_age_date",
                "featured_rank",
                "is_incomplete_or_stale",
                "content",
                "summary",
                "flashcards",
                "vector_embedding",
            ]
        },
    }

    assert execute_learn_search(search_params) == opensearch.conn.search.return_value

    opensearch.conn.search.assert_called_once_with(
        body=query,
        index=["testindex_course_default"],
    )


def test_execute_learn_search_for_content_file_query(opensearch):
    opensearch.conn.search.return_value = {
        "hits": {"total": {"value": 10, "relation": "eq"}}
    }

    search_params = {
        "aggregations": ["offered_by"],
        "q": "math",
        "limit": 1,
        "offset": 1,
        "content_feature_type": ["Online Textbook"],
        "endpoint": CONTENT_FILE_TYPE,
    }

    query = {
        "query": {
            "bool": {
                "must": [
                    {
                        "bool": {
                            "filter": [
                                {
                                    "bool": {
                                        "must": [
                                            {
                                                "bool": {
                                                    "should": [
                                                        {
                                                            "multi_match": {
                                                                "query": "math",
                                                                "fields": [
                                                                    "content.english",
                                                                    "title.english",
                                                                    "content_title.english",
                                                                    "description.english",
                                                                    "content_feature_type",
                                                                ],
                                                            }
                                                        },
                                                        {
                                                            "nested": {
                                                                "path": "departments",
                                                                "query": {
                                                                    "multi_match": {
                                                                        "query": "math",
                                                                        "fields": [
                                                                            "departments.department_id",
                                                                            "departments.name",
                                                                        ],
                                                                    }
                                                                },
                                                            }
                                                        },
                                                    ]
                                                }
                                            }
                                        ]
                                    }
                                }
                            ],
                            "should": [
                                {
                                    "multi_match": {
                                        "query": "math",
                                        "fields": [
                                            "content.english",
                                            "title.english",
                                            "content_title.english",
                                            "description.english",
                                            "content_feature_type",
                                        ],
                                    }
                                },
                                {
                                    "nested": {
                                        "path": "departments",
                                        "query": {
                                            "multi_match": {
                                                "query": "math",
                                                "fields": [
                                                    "departments.department_id",
                                                    "departments.name",
                                                ],
                                            }
                                        },
                                    }
                                },
                            ],
                        }
                    }
                ],
                "filter": [{"exists": {"field": "content_type"}}],
            }
        },
        "post_filter": {
            "bool": {
                "must": [
                    {
                        "bool": {
                            "should": [
                                {
                                    "term": {
                                        "content_feature_type": {
                                            "value": "Online Textbook",
                                            "case_insensitive": True,
                                        }
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        },
        "from": 1,
        "size": 1,
        "aggs": {
            "offered_by": {
                "aggs": {
                    "offered_by": {
                        "nested": {"path": "offered_by"},
                        "aggs": {
                            "offered_by": {
                                "terms": {"field": "offered_by.code", "size": 10000},
                                "aggs": {"root": {"reverse_nested": {}}},
                            }
                        },
                    }
                },
                "filter": {
                    "bool": {
                        "must": [
                            {
                                "bool": {
                                    "should": [
                                        {
                                            "term": {
                                                "content_feature_type": {
                                                    "value": "Online Textbook",
                                                    "case_insensitive": True,
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                },
            }
        },
        "_source": {
            "excludes": [
                "created_on",
                "course.course_numbers.sort_coursenum",
                "course.course_numbers.primary",
                "resource_relations",
                "is_learning_material",
                "resource_age_date",
                "featured_rank",
                "is_incomplete_or_stale",
                "content",
                "summary",
                "flashcards",
                "vector_embedding",
            ]
        },
    }

    assert execute_learn_search(search_params) == opensearch.conn.search.return_value

    opensearch.conn.search.assert_called_once_with(
        body=query,
        index=["testindex_course_default"],
        search_type="dfs_query_then_fetch",
    )


def test_get_similar_topics(settings, opensearch):
    """Test get_similar_topics makes a query for similar document topics"""
    input_doc = {"title": "title text", "description": "description text"}

    # topic d is least popular and should not show up, order does not matter
    opensearch.conn.search.return_value = {
        "hits": {
            "hits": [
                {
                    "_source": {
                        "topics": [
                            os_topic("topic a"),
                            os_topic("topic b"),
                            os_topic("topic d"),
                        ]
                    }
                },
                {"_source": {"topics": [os_topic("topic a"), os_topic("topic c")]}},
                {"_source": {"topics": [os_topic("topic a"), os_topic("topic c")]}},
                {"_source": {"topics": [os_topic("topic a"), os_topic("topic c")]}},
                {"_source": {"topics": [os_topic("topic a"), os_topic("topic b")]}},
            ]
        }
    }

    # results should be top 3 in decreasing order of frequency
    assert get_similar_topics(input_doc, 3, 1, 15) == ["topic a", "topic c", "topic b"]

    opensearch.conn.search.assert_called_once_with(
        body={
            "_source": {"includes": "topics"},
            "query": {
                "bool": {
                    "filter": [{"term": {"resource_type": "course"}}],
                    "must": [
                        {
                            "more_like_this": {
                                "like": [
                                    {
                                        "doc": input_doc,
                                        "fields": ["title", "description"],
                                    }
                                ],
                                "fields": [
                                    "course.course_numbers.value",
                                    "title",
                                    "description",
                                    "full_description",
                                ],
                                "min_term_freq": 1,
                                "min_doc_freq": 15,
                            }
                        }
                    ],
                }
            },
        },
        index=[f"{settings.OPENSEARCH_INDEX}_{COURSE_TYPE}_default"],
    )


@pytest.mark.django_db
def test_document_percolation(opensearch, mocker):
    """
    Test that our plugin handler is called when docs are percolated
    """
    mocker.patch(
        "learning_resources_search.indexing_api.index_percolators", autospec=True
    )
    mocker.patch(
        "learning_resources_search.indexing_api._update_document_by_id", autospec=True
    )
    og_query = {"test": "test"}
    percolate_hits = []
    for i in range(4):
        og_query["test"] += str(i)
        query = PercolateQueryFactory.create(original_query=og_query, query=og_query)
        percolate_hits.append(
            {
                "_index": "test-index",
                "_id": f"{query.id}",
                "id": f"{query.id}",
                "_score": 12.0,
            }
        )

    plugin_log_handler = mocker.patch("learning_resources_search.plugins.log")
    mocker.patch.object(Search, "execute")

    Search.execute.return_value = response.Response(
        Search().query(Percolate(field="query", index="test", id="test")),
        {
            "_shards": {"failed": 0, "successful": 10, "total": 10},
            "hits": {
                "hits": percolate_hits,
                "max_score": 12.0,
                "total": 123,
            },
            "timed_out": False,
            "took": 123,
        },
    ).hits

    lr = LearningResourceFactory.create()
    percolate_matches_for_document(lr.id)

    plugin_log_handler.debug.assert_called_once_with(
        "document %i percolated - %s",
        lr.id,
        list(PercolateQuery.objects.filter(id__in=[p["id"] for p in percolate_hits])),
    )


@pytest.mark.parametrize(
    ("sortby", "q", "result"),
    [
        ("-views", None, [{"views": {"order": "desc"}}]),
        ("-views", "text", [{"views": {"order": "desc"}}]),
        (
            None,
            None,
            [
                "featured_rank",
                "is_learning_material",
                "is_incomplete_or_stale",
                {"created_on": {"order": "desc"}},
            ],
        ),
        (None, "text", None),
    ],
)
def test_default_sort(sortby, q, result):
    search_params = {
        "aggregations": [],
        "q": q,
        "limit": 1,
        "offset": 1,
        "sortby": sortby,
        "endpoint": LEARNING_RESOURCE,
    }

    assert construct_search(search_params).to_dict().get("sort") == result


@pytest.mark.parametrize(
    "dev_mode",
    [True, False],
)
def test_dev_mode(dev_mode):
    search_params = {
        "aggregations": [],
        "q": "text",
        "limit": 1,
        "offset": 1,
        "dev_mode": dev_mode,
        "endpoint": LEARNING_RESOURCE,
    }

    if dev_mode:
        assert construct_search(search_params).to_dict().get("explain")
    else:
        assert construct_search(search_params).to_dict().get("explain") is None


@pytest.mark.parametrize(
    ("q", "sortby", "expect_dfs"),
    [
        ("text", None, True),
        ("text", "-readable_id", False),
        (None, None, False),
    ],
)
def test_dfs_search_type(q, sortby, expect_dfs):
    """DFS query_then_fetch should only be used for keyword searches sorted by relevance"""
    search_params = {
        "aggregations": [],
        "q": q,
        "limit": 1,
        "offset": 1,
        "sortby": sortby,
        "endpoint": LEARNING_RESOURCE,
    }

    search = construct_search(search_params)
    if expect_dfs:
        assert search._params.get("search_type") == "dfs_query_then_fetch"  # noqa: SLF001
    else:
        assert "search_type" not in search._params  # noqa: SLF001


@pytest.mark.django_db
def test_get_similar_topics_qdrant_uses_cached_embedding(mocker):
    """
    Test that get_similar_topics_qdrant uses a cached embedding when available
    """
    resource = MagicMock()
    resource.readable_id = "test-resource"
    value_doc = {"title": "Test Title", "description": "Test Description"}
    num_topics = 3

    mock_encoder = mocker.patch("learning_resources_search.api.dense_encoder")
    encoder_instance = mock_encoder.return_value
    encoder_instance.model_short_name.return_value = "test-model"
    encoder_instance.embed.return_value = [0.1, 0.2, 0.3]

    mock_client = mocker.patch("vector_search.utils.qdrant_client")
    client_instance = mock_client.return_value

    # Simulate a cached embedding in the response
    client_instance.retrieve.return_value = [
        MagicMock(vector={"test-model": [0.9, 0.8, 0.7]})
    ]

    mocker.patch(
        "learning_resources_search.api._qdrant_similar_results",
        return_value=[{"name": "topic1"}, {"name": "topic2"}],
    )

    result = get_similar_topics_qdrant(resource, value_doc, num_topics)

    # Assert that embed was NOT called (cached embedding used)
    encoder_instance.embed.assert_not_called()
    # Assert that the result is as expected
    assert result == ["topic1", "topic2"]
