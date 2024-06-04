# Generated by Django 4.2.13 on 2024-06-04 15:58

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        (
            "learning_resources",
            "0054_rename_description_learningresourceofferor_value_prop",
        ),
        ("channels", "0006_remove_channel_type_default"),
        ("testimonials", "0001_add_attestation_table"),
    ]

    operations = [
        migrations.AddField(
            model_name="attestation",
            name="offerors",
            field=models.ManyToManyField(
                blank=True,
                help_text="The offerors that this attestation can appear on",
                related_name="+",
                to="learning_resources.learningresourceofferor",
            ),
        ),
        migrations.AlterField(
            model_name="attestation",
            name="channels",
            field=models.ManyToManyField(
                blank=True,
                help_text="Channels that the testimonial belongs to",
                related_name="+",
                to="channels.fieldchannel",
            ),
        ),
    ]
