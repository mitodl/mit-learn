# Generated by Django 2.1.5 on 2019-02-06 19:52

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [("channels", "0019_channel_about")]

    operations = [
        migrations.RemoveField(model_name="article", name="cover_image_small")
    ]
