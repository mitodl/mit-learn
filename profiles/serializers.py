"""
Serializers for profile REST APIs
"""
from django.contrib.auth import get_user_model
from django.db import transaction

import ulid
from rest_framework import serializers

from channels.api import get_or_create_auth_tokens
from notifications.api import ensure_notification_settings
from profiles.models import Profile, PROFILE_PROPS


class ProfileSerializer(serializers.ModelSerializer):
    """Serializer for Profile"""
    email_optin = serializers.BooleanField(write_only=True, required=False)
    toc_optin = serializers.BooleanField(write_only=True, required=False)
    username = serializers.SerializerMethodField(read_only=True)

    def get_username(self, obj):
        """Custom getter for the username"""
        return str(obj.user.username)

    def update(self, instance, validated_data):
        with transaction.atomic():
            for attr, value in validated_data.items():
                setattr(instance, attr, value)

            update_image = 'image_file' in validated_data
            instance.save(update_image=update_image)
            return instance

    class Meta:
        model = Profile
        fields = ('name', 'image', 'image_small', 'image_medium',
                  'image_file', 'image_small_file', 'image_medium_file',
                  'email_optin', 'toc_optin', 'bio', 'headline', 'username')
        read_only_fields = (
            'image_file_small',
            'image_file_medium',
            'username'
        )


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User"""
    # username cannot be set but a default is generated on create using ulid.new
    username = serializers.CharField(
        read_only=True,
        default=serializers.CreateOnlyDefault(ulid.new)
    )
    email = serializers.CharField(write_only=True, required=False)
    profile = ProfileSerializer()

    def create(self, validated_data):
        profile_data = validated_data.pop('profile') or {}
        with transaction.atomic():
            user = get_user_model().objects.create(**validated_data)
            Profile.objects.create(user=user, **profile_data)
            ensure_notification_settings(user)

        get_or_create_auth_tokens(user)
        return user

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', None)

        with transaction.atomic():

            instance.email = validated_data.pop('email', instance.email)
            instance.save()

            if profile_data:
                profile = instance.profile
                for prop_name in PROFILE_PROPS:
                    setattr(profile, prop_name, profile_data.get(prop_name, getattr(profile, prop_name)))
                profile.save()

        return instance

    class Meta:
        model = get_user_model()
        fields = ('id', 'username', 'profile', 'email')
        read_only_fields = ('id',)
