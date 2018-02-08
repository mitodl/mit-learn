# -*- coding: utf-8 -*-
# Generated by Django 1.10.5 on 2018-02-09 19:37
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='AuthenticatedSite',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_on', models.DateTimeField(auto_now_add=True)),
                ('updated_on', models.DateTimeField(auto_now=True)),
                ('key', models.CharField(help_text='Key to lookup site in JWT token, must match exactly the key set by the authenticating site', max_length=20)),
                ('title', models.CharField(help_text='Name of site to display in discussions', max_length=50)),
                ('base_url', models.URLField(help_text='Base url / home page for the site (e.g. http://my.site.domain/)', verbose_name='External Base URL')),
                ('login_url', models.URLField(help_text='This url should require a user to login and then redirect back to discussions (e.g. http://my.site.domain/discussions)', verbose_name='External Login URL')),
                ('session_url', models.URLField(help_text='The URL where discussions can request a new session (e.g. http://my.site.domain/discussionsToken)', verbose_name='External Session URL')),
                ('tos_url', models.URLField(help_text="There URL where discussions can link the user to view the site's TOS (e.g. http://my.site.domain/terms-of-service)", verbose_name='External TOS URL')),
            ],
            options={
                'abstract': False,
            },
        ),
    ]
