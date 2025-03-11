from decimal import Decimal

import pytest

from learning_resources.constants import CertificationType
from learning_resources.factories import (
    LearningResourceFactory,
    LearningResourceOfferorFactory,
    LearningResourcePriceFactory,
)
from learning_resources.serializers import LearningResourceSerializer
from vector_search.serializers import LearningResourceMetadataDisplaySerializer

pytestmark = pytest.mark.django_db


def test_certificate_display():
    # if certification is none and the resource is free - show "no certificate"
    resource = LearningResourceFactory(
        certification_type=CertificationType.none.name,
        professional=False,
        prices=[Decimal("0.00")],
    )
    serialized_resource = LearningResourceSerializer(resource).data
    metadata_serializer = LearningResourceMetadataDisplaySerializer(serialized_resource)
    assert serialized_resource["free"]
    assert (
        metadata_serializer.data["certification_display"]
        == CertificationType.none.value
    )

    # if course is "free" and certificate type is not explicitly "none" then dont display anything
    resource = LearningResourceFactory(
        certification_type=CertificationType.completion.name,
        prices=[Decimal("0.00")],
        resource_type="course",
        professional=False,
    )
    resource.resource_prices.set(
        [LearningResourcePriceFactory.create(amount=Decimal("0.00"))]
    )
    serialized_resource = LearningResourceSerializer(resource).data
    metadata_serializer = LearningResourceMetadataDisplaySerializer(serialized_resource)
    assert serialized_resource["free"]
    assert metadata_serializer.data["certification_display"] is None

    # if resource is not free and certification is not none - show the certification type
    resource = LearningResourceFactory(
        certification=False,
        professional=False,
        resource_type="course",
        certification_type=CertificationType.professional.name,
        prices=[Decimal("100.00")],
        offered_by=LearningResourceOfferorFactory.create(professional=False),
    )
    resource.resource_prices.set(
        [LearningResourcePriceFactory.create(amount=Decimal("100.00"))]
    )
    serialized_resource = LearningResourceSerializer(resource).data
    metadata_serializer = LearningResourceMetadataDisplaySerializer(serialized_resource)

    assert not serialized_resource["free"]
    assert (
        metadata_serializer.data["certification_display"]
        == CertificationType.professional.value
    )


def test_price_display():
    # if certification is none and the resource is free - show "free"
    resource = LearningResourceFactory(
        certification_type=CertificationType.none.name, prices=[Decimal("0.00")]
    )
    resource.resource_prices.set(
        [
            LearningResourcePriceFactory.create(amount=Decimal("0.00")),
            LearningResourcePriceFactory.create(amount=Decimal("100.00")),
        ]
    )
    serialized_resource = LearningResourceSerializer(resource).data
    metadata_serializer = LearningResourceMetadataDisplaySerializer(serialized_resource)
    assert serialized_resource["free"]
    assert metadata_serializer.data["price_display"] == "Free"

    # if course is "free" and certificate type is not explicitly "none" then display Free as well as certificate price
    resource = LearningResourceFactory(
        certification_type=CertificationType.completion.name,
        prices=[Decimal("0.00"), Decimal("100.00")],
        resource_type="course",
        professional=False,
    )
    resource.resource_prices.set(
        [
            LearningResourcePriceFactory.create(amount=Decimal("0.00")),
            LearningResourcePriceFactory.create(amount=Decimal("100.00")),
        ]
    )
    serialized_resource = LearningResourceSerializer(resource).data
    metadata_serializer = LearningResourceMetadataDisplaySerializer(serialized_resource)
    assert serialized_resource["free"]
    assert (
        metadata_serializer.data["price_display"]
        == f"Free (Earn a certificate: ${serialized_resource['prices'][1]})"
    )

    # if resource is not free and certification is not none - show the price
    resource = LearningResourceFactory(
        certification=False,
        professional=False,
        resource_type="course",
        certification_type=CertificationType.professional.name,
        prices=[Decimal("100.00")],
    )
    resource.resource_prices.set(
        [LearningResourcePriceFactory.create(amount=Decimal("100.00"))]
    )
    serialized_resource = LearningResourceSerializer(resource).data
    metadata_serializer = LearningResourceMetadataDisplaySerializer(serialized_resource)
    assert not serialized_resource["free"]
    assert (
        metadata_serializer.data["price_display"]
        == f"${serialized_resource['prices'][0]}"
    )
