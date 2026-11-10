from django.db import migrations


def remove_people_widgets(apps, schema_editor):
    """
    Remove People widget instances, whose configuration lists usernames.

    The admin's widget_type select has no People option, so re-saving a widget
    list would turn these into Markdown widgets and serve the usernames again.
    """
    WidgetInstance = apps.get_model("widgets", "WidgetInstance")
    WidgetInstance.objects.filter(widget_type="People").delete()


class Migration(migrations.Migration):
    dependencies = [("widgets", "0003_alter_widgetinstance_configuration")]

    operations = [
        migrations.RunPython(
            remove_people_widgets, reverse_code=migrations.RunPython.noop
        )
    ]
