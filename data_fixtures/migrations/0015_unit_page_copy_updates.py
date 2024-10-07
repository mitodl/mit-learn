# Generated by Django 4.2.14 on 2024-07-16 17:30

from django.db import migrations

fixtures = [
    {
        "name": "mitpe",
        "offeror_configuration": {
            "value_prop": (
                "MIT Professional Education is a leader in technology and "
                "engineering education for working professionals pursuing "
                "career advancement, and organizations seeking to meet modern-day "
                "challenges by expanding the knowledge and skills of their employees. "
                "Courses are delivered in a range of formats—in-person (on-campus "
                "and live online), online, and through hybrid approaches—to "
                "meet the needs of today's learners."
            ),
        },
        "channel_configuration": {
            "sub_heading": (
                "MIT Professional Education is a leader in technology and "
                "engineering education for working professionals pursuing "
                "career advancement, and organizations seeking to meet modern-day "
                "challenges by expanding the knowledge and skills of their employees. "
                "Courses are delivered in a range of formats—in-person (on-campus "
                "and live online), online, and through hybrid approaches—to "
                "meet the needs of today's learners."
            ),
        },
    },
]


def update_copy(apps, schema_editor):
    Channel = apps.get_model("channels", "Channel")
    LearningResourceOfferor = apps.get_model(
        "learning_resources", "LearningResourceOfferor"
    )
    for fixture in fixtures:
        channel_configuration_updates = fixture["channel_configuration"]
        offeror_configuration_updates = fixture["offeror_configuration"]
        channel = Channel.objects.get(name=fixture["name"])
        if Channel.objects.filter(name=fixture["name"]).exists():
            for key, val in channel_configuration_updates.items():
                channel.configuration[key] = val
            channel.save()
        if LearningResourceOfferor.objects.filter(code=fixture["name"]).exists():
            offeror = LearningResourceOfferor.objects.get(code=fixture["name"])
            for key, val in offeror_configuration_updates.items():
                setattr(offeror, key, val)
            offeror.save()


class Migration(migrations.Migration):
    dependencies = [
        ("data_fixtures", "0014_add_department_SP"),
    ]

    operations = [
        migrations.RunPython(update_copy, migrations.RunPython.noop),
    ]
