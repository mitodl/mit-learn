"""
Serializers for profile REST APIs
"""

import logging

import ulid
from django.contrib.auth import get_user_model
from django.db import transaction
from django.urls import reverse
from drf_spectacular.utils import extend_schema_field
from keycloak.exceptions import KeycloakError
from mitol.common.serializers import BaseSerializer
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from authentication import api as auth_api
from learning_resources.models import LearningResourceTopic
from learning_resources.permissions import is_admin_user, is_learning_path_editor
from learning_resources.serializers import LearningResourceTopicSerializer
from main.constants import (
    ALLOWED_HTML_ATTRIBUTES_WITH_LINKS,
    ALLOWED_HTML_TAGS_WITH_LINKS,
)
from main.utils import clean_data
from profiles.api import sync_email_optin_to_keycloak
from profiles.models import (
    PROFILE_PROPS,
    Profile,
    ProgramCertificate,
    ProgramLetter,
)
from profiles.utils import (
    IMAGE_MEDIUM,
    IMAGE_SMALL,
    fetch_program_letter_template_data,
    image_uri,
)
from website_content.permissions import is_website_content_editor

log = logging.getLogger(__name__)

User = get_user_model()


class TopicInterestsField(serializers.Field):
    """
    Serializer field for topic interests
    """

    def get_attribute(self, instance):
        """Read the dual-path list instead of the raw related manager"""
        return instance.annotated_topic_interests

    def to_representation(self, value):
        """Serialize the topic_interests"""
        return LearningResourceTopicSerializer(value, many=True).data

    def to_internal_value(self, data):
        """Validate the topic_interests"""
        topic_ids = data

        if not topic_ids:
            return []

        if not isinstance(topic_ids, list) or not all(
            isinstance(topic_id, int) for topic_id in topic_ids
        ):
            msg = "Should be a list of topic integer ids"
            raise serializers.ValidationError(msg)

        topics = LearningResourceTopic.objects.filter(parent=None, id__in=topic_ids)

        valid_ids = {topic.id for topic in topics}
        missing_ids = set(topic_ids) - valid_ids

        if missing_ids:
            missing = ",".join(map(str, missing_ids))
            message = f"Invalid id(s): {missing}"
            raise serializers.ValidationError(message)

        return topics


class PreferencesSearchSerializer(serializers.Serializer):
    """Serializer for profile search preference filters"""

    certification = serializers.BooleanField(required=False)
    topic = serializers.ListField(child=serializers.CharField(), required=False)
    delivery = serializers.ListField(child=serializers.CharField(), required=False)


class ProfileSerializer(serializers.ModelSerializer):
    """Serializer for Profile"""

    name = serializers.SerializerMethodField(read_only=True)
    email_optin = serializers.BooleanField(required=False, allow_null=True)
    toc_optin = serializers.BooleanField(write_only=True, required=False)
    username = serializers.SerializerMethodField(read_only=True)
    profile_image_medium = serializers.SerializerMethodField(read_only=True)
    profile_image_small = serializers.SerializerMethodField(read_only=True)
    placename = serializers.SerializerMethodField(read_only=True)
    topic_interests = TopicInterestsField(default=list)
    preference_search_filters = serializers.SerializerMethodField(read_only=True)

    def get_name(self, obj) -> str:
        """Get the user's name"""
        return obj.name or " ".join(
            filter(lambda name: name, [obj.user.first_name, obj.user.last_name])
        )

    def get_username(self, obj) -> str:
        """Custom getter for the username"""  # noqa: D401
        return str(obj.user.username)

    def get_profile_image_medium(self, obj) -> str:
        """Custom getter for medium profile image"""  # noqa: D401
        return image_uri(obj, IMAGE_MEDIUM)

    def get_profile_image_small(self, obj) -> str:
        """Custom getter for small profile image"""  # noqa: D401
        return image_uri(obj, IMAGE_SMALL)

    def get_placename(self, obj) -> str:
        """Custom getter for location text"""  # noqa: D401
        if obj.location:
            return obj.location.get("value", "")
        return ""

    @extend_schema_field(PreferencesSearchSerializer)
    def get_preference_search_filters(self, obj) -> dict:
        """Get search filters based on profile preferences."""
        filters = {}
        if (
            obj.certificate_desired
            and obj.certificate_desired != Profile.CertificateDesired.NOT_SURE_YET.value
        ):
            filters["certification"] = (
                obj.certificate_desired == Profile.CertificateDesired.YES.value
            )
        topic_names = [topic.name for topic in obj.annotated_topic_interests]
        if topic_names:
            filters["topic"] = topic_names
        if obj.delivery:
            filters["delivery"] = obj.delivery
        return PreferencesSearchSerializer(instance=filters).data

    def validate_location(self, location):
        """
        Validator for location.
        """  # noqa: D401
        if location and (not isinstance(location, dict) or ("value" not in location)):
            msg = "Missing/incorrect location information"
            raise ValidationError(msg)
        return location

    def update(self, instance, validated_data):
        """Update the profile and related docs in OpenSearch"""
        with transaction.atomic():
            topic_interests = validated_data.pop("topic_interests", None)

            if topic_interests is not None:
                instance.topic_interests.set(topic_interests)
                # drop any prefetched/cached list so the response reserializes
                # the new interests
                instance.__dict__.pop("annotated_topic_interests", None)

            # A null means no preference was expressed, so leave Keycloak alone
            # rather than pushing the falsey coercion as an opt-out.
            email_optin_changed = (
                validated_data.get("email_optin") is not None
                and validated_data["email_optin"] != instance.email_optin
            )

            for attr, value in validated_data.items():
                setattr(instance, attr, value)

            if email_optin_changed:
                try:
                    sync_email_optin_to_keycloak(
                        instance.user, email_optin=instance.email_optin
                    )
                except KeycloakError as exc:
                    log.exception(
                        "Failed to sync email_optin to Keycloak for user %s",
                        instance.user.id,
                    )
                    raise ValidationError(
                        {
                            "email_optin": (
                                "Unable to update email preferences at this time."
                            )
                        }
                    ) from exc

            update_image = "image_file" in validated_data
            instance.save(update_image=update_image)
            return instance

    class Meta:
        model = Profile
        fields = (
            "name",
            "image",
            "image_small",
            "image_medium",
            "image_file",
            "image_small_file",
            "image_medium_file",
            "profile_image_small",
            "profile_image_medium",
            "email_optin",
            "toc_optin",
            "bio",
            "headline",
            "username",
            "placename",
            "location",
            "topic_interests",
            "goals",
            "current_education",
            "certificate_desired",
            "time_commitment",
            "delivery",
            "preference_search_filters",
        )
        read_only_fields = (
            "image_file_small",
            "image_file_medium",
            "profile_image_small",
            "profile_image_medium",
            "username",
            "placename",
            "preference_search_filters",
        )
        extra_kwargs = {"location": {"write_only": True}}


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User"""

    # username cannot be set but a default is generated on create using ulid.new
    username = serializers.CharField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)
    email = serializers.CharField(write_only=True)
    is_learning_path_editor = serializers.SerializerMethodField()
    is_article_editor = serializers.SerializerMethodField()
    is_authenticated = serializers.BooleanField(read_only=True)
    profile = ProfileSerializer(required=False)

    def get_is_learning_path_editor(self, instance) -> bool:  # noqa: ARG002
        request = self.context.get("request")
        if request:
            return is_admin_user(request) or is_learning_path_editor(request)
        return False

    def get_is_article_editor(self, instance) -> bool:  # noqa: ARG002
        request = self.context.get("request")
        if request:
            return is_admin_user(request) or is_website_content_editor(request)
        return False

    def create(self, validated_data):
        profile_data = validated_data.pop("profile") or {}
        username = ulid.new()
        email = validated_data.get("email")

        with transaction.atomic():
            return auth_api.create_user(username, email, profile_data)

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", None)
        email = validated_data.get("email", None)

        with transaction.atomic():
            if email:
                instance.email = email
                instance.save()

            if profile_data:
                profile = instance.profile
                for prop_name in PROFILE_PROPS:
                    setattr(
                        profile,
                        prop_name,
                        profile_data.get(prop_name, getattr(profile, prop_name)),
                    )
                profile.save()
        return instance

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "global_id",
            "profile",
            "email",
            "first_name",
            "last_name",
            "is_article_editor",
            "is_learning_path_editor",
            "is_authenticated",
        )
        read_only_fields = ("id", "username", "global_id", "is_authenticated")


class CurrentUserSerializer(UserSerializer):
    """
    Serializer for the requesting user.

    Unlike UserSerializer this exposes the user's own email plus whether they
    can manage their credentials, both of which the settings page needs. It is
    read-only: users change their email through Keycloak, not through us.
    """

    # AnonymousUser has no email attribute, and a read-only field whose
    # attribute is missing is dropped from the output entirely (the same reason
    # first_name/last_name don't appear for anonymous users). The default keeps
    # the key present and blank instead.
    email = serializers.CharField(read_only=True, default="")
    is_sso_user = serializers.SerializerMethodField()

    def get_is_sso_user(self, instance) -> bool:
        """
        Whether the user signs in through an external identity provider, and so
        cannot change their email or password through us.
        """
        return auth_api.is_sso_user(instance)

    class Meta(UserSerializer.Meta):
        fields = (*UserSerializer.Meta.fields, "is_sso_user")


class ProgramCertificateSerializer(BaseSerializer):
    """
    Serializer for Program Certificates
    """

    # user_letter isn't a model field; callers attach the user's ProgramLetter
    # to each certificate instance.
    required_prefetches: list[str] = ["user_letter"]

    program_letter_generate_url = serializers.SerializerMethodField()
    program_letter_share_url = serializers.SerializerMethodField()

    def get_program_letter_generate_url(self, instance) -> str:
        request = self.context.get("request")
        letter_url = reverse(
            "profile:program-letter-intercept",
            kwargs={"program_id": instance.micromasters_program_id},
        )
        if request:
            return request.build_absolute_uri(letter_url)
        return letter_url

    def get_program_letter_share_url(self, instance) -> str:
        # Callers attach user_letter, creating the letter if needed, so this is
        # always a real URL -- same contract as when the get_or_create lived here.
        letter_url = instance.user_letter.get_absolute_url()
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(letter_url)
        return letter_url

    class Meta:
        model = ProgramCertificate
        fields = "__all__"


# The letter body is authored in MicroMasters' Wagtail CMS and rendered here
# with dangerouslySetInnerHTML, so it is sanitized on the way out.
#
# Live letters use <a>, <b>, <br>, <p>, <ul> and <li>, and the letter page
# styles h2-h4 inside its header and footer blocks, so headings are kept as
# well -- sanitizing them away would silently drop authored content rather
# than protect anyone. Links keep only href/title.
PROGRAM_LETTER_ALLOWED_HTML_TAGS = ALLOWED_HTML_TAGS_WITH_LINKS | {
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
}


class SanitizedHTMLField(serializers.CharField):
    """A CharField whose HTML is sanitized as it is serialized out."""

    def to_representation(self, value) -> str:
        """Strip any markup outside the program letter allowlist"""
        return clean_data(
            super().to_representation(value),
            tags=PROGRAM_LETTER_ALLOWED_HTML_TAGS,
            attributes=ALLOWED_HTML_ATTRIBUTES_WITH_LINKS,
        )


class ProgramLetterTemplateFieldSerializer(serializers.Serializer):
    """
    Seriializer for program letter template data which is configured in
    micromasters
    """

    id = serializers.IntegerField()
    meta = serializers.JSONField()
    title = serializers.CharField()
    program_id = serializers.IntegerField()
    program_letter_footer = serializers.JSONField()
    program_letter_footer_text = SanitizedHTMLField()
    program_letter_header_text = SanitizedHTMLField()
    program_letter_text = SanitizedHTMLField()
    program_letter_logo = serializers.JSONField()
    program_letter_signatories = serializers.ListField(child=serializers.JSONField())


class ProgramLetterCertificateSerializer(serializers.ModelSerializer):
    """
    The certificate fields the public program letter view needs.

    ProgramLetterViewSet is unauthenticated -- anyone holding a letter's uuid
    can read it -- so this exposes only what the letter itself already states:
    who earned it and which program. The learner's email, postal address, date
    of birth, gender and platform usernames stay behind the authenticated
    certificate list, which uses ProgramCertificateSerializer.
    """

    class Meta:
        model = ProgramCertificate
        fields = ["user_full_name", "program_title"]


class ProgramLetterSerializer(serializers.ModelSerializer):
    """
    Serializer for Program Letters
    """

    id = serializers.UUIDField(read_only=True)

    template_fields = serializers.SerializerMethodField()

    certificate = ProgramLetterCertificateSerializer()

    @extend_schema_field(ProgramLetterTemplateFieldSerializer())
    def get_template_fields(self, instance) -> dict:
        """Get template fields from the micromasters cms api"""
        return ProgramLetterTemplateFieldSerializer(
            fetch_program_letter_template_data(instance)
        ).data

    class Meta:
        model = ProgramLetter
        fields = ["id", "template_fields", "certificate"]
