"""Serializers for channels_fields"""
import copy
import logging
from typing import List

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from drf_spectacular.utils import extend_schema_field

from channels_fields.api import add_user_role, is_moderator
from channels_fields.constants import FIELD_ROLE_MODERATORS
from channels_fields.models import FieldChannel, FieldList, Subfield
from course_catalog.constants import PrivacyLevel
from course_catalog.models import UserList
from course_catalog.serializers import UserListSerializer
from profiles.models import Profile

User = get_user_model()

log = logging.getLogger(__name__)


class WriteableSerializerMethodField(serializers.SerializerMethodField):
    """
    A SerializerMethodField which has been marked as not read_only so that submitted data passed validation.
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.read_only = False

    def to_internal_value(self, data):
        return data


class ChannelAppearanceMixin(serializers.Serializer):
    """Serializer mixin for channel appearance"""

    avatar = WriteableSerializerMethodField()
    avatar_small = serializers.SerializerMethodField()
    avatar_medium = serializers.SerializerMethodField()
    banner = WriteableSerializerMethodField()
    is_moderator = serializers.SerializerMethodField()

    def get_is_moderator(self, instance) -> bool:
        """Return true if user is a moderator for the channel"""
        request = self.context.get("request")
        if request and is_moderator(request.user, instance.name):
            return True
        return False

    def get_avatar(self, channel) -> str:
        """Get the avatar image URL"""
        return channel.avatar.url if channel.avatar else None

    def get_avatar_small(self, channel) -> str:
        """Get the avatar image small URL"""
        return channel.avatar_small.url if channel.avatar_small else None

    def get_avatar_medium(self, channel) -> str:
        """Get the avatar image medium URL"""
        return channel.avatar_medium.url if channel.avatar_medium else None

    def get_banner(self, channel) -> str:
        """Get the banner image URL"""
        return channel.banner.url if channel.banner else None

    def validate_avatar(self, value):
        """Empty validation function, but this is required for WriteableSerializerMethodField"""
        if not hasattr(value, "name"):
            raise ValidationError("Expected avatar to be a file")
        return {"avatar": value}

    def validate_banner(self, value):
        """Empty validation function, but this is required for WriteableSerializerMethodField"""
        if not hasattr(value, "name"):
            raise ValidationError("Expected banner to be a file")
        return {"banner": value}


class SubfieldSerializer(serializers.ModelSerializer):
    """Serializer for Subfields"""

    parent_field = serializers.SlugRelatedField(
        many=False, read_only=True, slug_field="name", source="parent_channel"
    )

    field_channel = serializers.SlugRelatedField(
        many=False, read_only=True, slug_field="name"
    )

    class Meta:
        model = Subfield
        fields = ("parent_field", "field_channel", "position")


class FieldChannelSerializer(ChannelAppearanceMixin, serializers.ModelSerializer):
    """Serializer for FieldChannel"""

    lists = serializers.SerializerMethodField()
    featured_list = UserListSerializer(many=False, read_only=True)
    subfields = SubfieldSerializer(many=True, read_only=True)

    @extend_schema_field(UserListSerializer(many=True))
    def get_lists(self, instance):
        """Returns the field's list of UserLists"""
        return [
            UserListSerializer(field_list.field_list).data
            for field_list in instance.lists.all().order_by("position")
        ]

    class Meta:
        model = FieldChannel
        fields = (
            "name",
            "title",
            "about",
            "public_description",
            "subfields",
            "featured_list",
            "lists",
            "about",
            "avatar",
            "avatar_medium",
            "avatar_small",
            "banner",
            "widget_list",
            "updated_on",
            "created_on",
            "id",
            "ga_tracking_id",
            "is_moderator",
        )
        read_only_fields = fields


class FieldChannelCreateSerializer(serializers.ModelSerializer):
    """Write serializer for FieldChannel"""

    featured_list = serializers.PrimaryKeyRelatedField(
        many=False,
        allow_null=True,
        allow_empty=True,
        required=False,
        queryset=UserList.objects.filter(privacy_level=PrivacyLevel.public.value),
    )
    lists = WriteableSerializerMethodField()
    subfields = WriteableSerializerMethodField()

    class Meta:
        model = FieldChannel
        fields = (
            "name",
            "title",
            "public_description",
            "subfields",
            "featured_list",
            "lists",
            "about",
        )

    def validate_lists(self, lists: List[int]):
        """Validator for lists"""
        if len(lists) > 0:
            try:
                valid_list_ids = set(
                    UserList.objects.filter(
                        id__in=lists, privacy_level=PrivacyLevel.public.value
                    ).values_list("id", flat=True)
                )
            except (ValueError, TypeError):
                raise ValidationError("List ids must be integers")
            missing = set(lists).difference(valid_list_ids)
            if missing:
                raise ValidationError(f"Invalid list ids: {missing}")
        return {"lists": lists}

    @extend_schema_field(UserListSerializer(many=True))
    def get_lists(self, instance):
        """Returns the field's list of UserLists"""
        return [
            UserListSerializer(field_list.field_list).data
            for field_list in instance.lists.all()
            .prefetch_related("field_list", "field_channel")
            .order_by("position")
        ]

    def validate_subfields(self, subfields: List[str]):
        """Validator for subfields"""
        if len(subfields) > 0:
            try:
                valid_subfield_names = set(
                    FieldChannel.objects.filter(name__in=subfields).values_list(
                        "name", flat=True
                    )
                )
                missing = set(subfields).difference(valid_subfield_names)
                if missing:
                    raise ValidationError(f"Invalid subfield names: {missing}")
            except (ValueError, TypeError):
                raise ValidationError("Subfields must be strings")
        return {"subfields": subfields}

    @extend_schema_field(SubfieldSerializer(many=True))
    def get_subfields(self, instance):
        """Returns the list of topics"""
        return [
            SubfieldSerializer(subfield).data
            for subfield in instance.subfields.all()
            .prefetch_related("field_channel")
            .order_by("position")
        ]

    def upsert_field_lists(self, instance, validated_data):
        """Update or create field lists for a new or updated field channel"""
        if "lists" not in validated_data:
            return
        field_lists = validated_data.pop("lists")
        new_lists = set()
        former_lists = list(instance.lists.values_list("id", flat=True))
        for (idx, list_pk) in enumerate(field_lists):
            userlist = UserList.objects.filter(pk=list_pk).first()
            if userlist:
                field_list, _ = FieldList.objects.update_or_create(
                    field_channel=instance,
                    field_list=userlist,
                    defaults={"position": idx},
                )
                new_lists.add(field_list)
        removed_lists = list(set(former_lists) - {list.id for list in new_lists})
        with transaction.atomic():
            instance.lists.set(new_lists)
            instance.lists.filter(id__in=removed_lists).delete()

    def upsert_subfields(self, instance, validated_data):
        """Update or create subfields for a new or updated field channel"""
        if "subfields" not in validated_data:
            return
        subfields = validated_data.pop("subfields")
        new_subfields = set()
        former_subfields = list(
            instance.subfields.values_list("field_channel__name", flat=True)
        )
        for (idx, field_name) in enumerate(subfields):
            field_channel = FieldChannel.objects.filter(name=field_name).first()
            if field_channel and field_channel.pk != instance.pk:
                subfield, _ = Subfield.objects.update_or_create(
                    parent_channel=instance,
                    field_channel=field_channel,
                    defaults={"position": idx},
                )
                new_subfields.add(subfield)
        removed_subfields = list(
            set(former_subfields)
            - {subfield.field_channel.name for subfield in new_subfields}
        )
        with transaction.atomic():
            instance.subfields.set(new_subfields)
            instance.subfields.filter(
                field_channel__name__in=removed_subfields
            ).delete()

    def create(self, validated_data):
        base_field_data = copy.deepcopy(validated_data)
        for key in ("subfields", "lists"):
            base_field_data.pop(key, None)
        with transaction.atomic():
            field_channel = super().create(base_field_data)
            self.upsert_field_lists(field_channel, validated_data)
            self.upsert_subfields(field_channel, validated_data)
            return field_channel


class FieldChannelWriteSerializer(FieldChannelCreateSerializer, ChannelAppearanceMixin):
    """Similar to FieldChannelCreateSerializer, with read-only name"""

    class Meta:
        model = FieldChannel
        fields = (
            "name",
            "title",
            "public_description",
            "subfields",
            "featured_list",
            "lists",
            "about",
            "avatar",
            "banner",
        )
        read_only_fields = ("name",)

    def update(self, instance, validated_data):
        """Update an existing field channel"""
        self.upsert_field_lists(instance, validated_data)
        self.upsert_subfields(instance, validated_data)

        avatar = validated_data.pop("avatar", None)
        if avatar:
            instance.avatar.save(
                f"field_channel_avatar_{instance.name}.jpg", avatar, save=False
            )
            instance.save(update_fields=["avatar"])

        banner = validated_data.pop("banner", None)
        if banner:
            instance.banner.save(
                f"field_channel_banner_{instance.name}.jpg", banner, save=False
            )
            instance.save(update_fields=["banner"])

        return super().update(instance, validated_data)


class FieldModeratorSerializer(serializers.Serializer):
    """Serializer for moderators"""

    moderator_name = WriteableSerializerMethodField()
    email = WriteableSerializerMethodField()
    full_name = serializers.SerializerMethodField()

    def get_moderator_name(self, instance) -> str:
        """Returns the name for the moderator"""
        return instance.username

    def get_email(self, instance) -> str:
        """Get the email from the associated user"""
        return (
            User.objects.filter(username=instance.username)
            .values_list("email", flat=True)
            .first()
        )

    def get_full_name(self, instance) -> str:
        """Get the full name of the associated user"""
        return (
            Profile.objects.filter(user__username=instance.username)
            .values_list("name", flat=True)
            .first()
        )

    def validate_moderator_name(self, value):
        """Validate moderator name"""
        if not isinstance(value, str):
            raise ValidationError("username must be a string")
        if not User.objects.filter(username=value).exists():
            raise ValidationError("username is not a valid user")
        return {"moderator_name": value}

    def validate_email(self, value):
        """Validate email"""
        if not isinstance(value, str):
            raise ValidationError("email must be a string")
        if not User.objects.filter(email__iexact=value).exists():
            raise ValidationError("email does not exist")
        return {"email": value}

    def create(self, validated_data):
        field_name = self.context["view"].kwargs["field_name"]
        moderator_name = validated_data.get("moderator_name")
        email = validated_data.get("email")

        if email and moderator_name:
            raise ValueError("Only one of moderator_name, email should be specified")

        if moderator_name:
            username = moderator_name
        elif email:
            username = User.objects.get(email__iexact=email).username
        else:
            raise ValueError("Missing moderator_name or email")

        user = User.objects.get(username=username)
        add_user_role(
            FieldChannel.objects.get(name=field_name), FIELD_ROLE_MODERATORS, user
        )
        return user
