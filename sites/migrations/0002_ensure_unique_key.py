# -*- coding: utf-8 -*-
# Generated by Django 1.10.5 on 2018-02-12 20:22
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sites', '0001_add_authenticated_site'),
    ]

    operations = [
        migrations.AlterField(
            model_name='authenticatedsite',
            name='key',
            field=models.CharField(help_text='Key to lookup site in JWT token, must match exactly the key set by the authenticating site', max_length=20, unique=True),
        ),
    ]
