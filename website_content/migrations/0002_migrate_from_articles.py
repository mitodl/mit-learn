"""
Data migration: copy existing records from the old articles_* tables into the
new website_content_* tables.

Uses raw SQL and Python so this migration can run without the articles app
being present in INSTALLED_APPS at migration time.

All migrated WebsiteContent rows receive content_type='news' because all
existing Article records are news posts.

Handles fresh databases (no articles_* tables) gracefully.
"""

import logging

from django.db import migrations

log = logging.getLogger(__name__)


def migrate_articles_to_website_content(apps, schema_editor):
    conn = schema_editor.connection

    with conn.cursor() as cursor:
        # Skip if the old articles table doesn't exist (fresh DB / CI)
        cursor.execute(
            "SELECT EXISTS ("
            "  SELECT 1 FROM information_schema.tables"
            "  WHERE table_name = 'articles_article'"
            ")"
        )
        if not cursor.fetchone()[0]:
            log.info("articles_article not found; skipping data migration.")
            return

        cursor.execute(
            "INSERT INTO website_content_websitecontent"
            "    (id, created_on, updated_on, user_id, content, title,"
            "     author_name, slug, is_published, publish_date, content_type)"
            " SELECT id, created_on, updated_on, user_id, content, title,"
            "        author_name, slug, is_published, publish_date, 'news'"
            " FROM articles_article"
            " ON CONFLICT (id) DO NOTHING"
        )
        log.info("Copied %s rows from articles_article.", cursor.rowcount)

        # Advance sequence so future inserts don't collide with copied IDs
        cursor.execute(
            "SELECT setval("
            "    pg_get_serial_sequence("
            "        'website_content_websitecontent', 'id'"
            "    ),"
            "    COALESCE("
            "        (SELECT MAX(id) FROM website_content_websitecontent), 1"
            "    )"
            ")"
        )

        cursor.execute(
            "SELECT EXISTS ("
            "  SELECT 1 FROM information_schema.tables"
            "  WHERE table_name = 'articles_articleimageupload'"
            ")"
        )
        if cursor.fetchone()[0]:
            cursor.execute(
                "INSERT INTO website_content_websitecontentimageupload"
                "    (id, user_id, image_file, created_at)"
                " SELECT id, user_id, image_file, created_at"
                " FROM articles_articleimageupload"
                " ON CONFLICT (id) DO NOTHING"
            )
            log.info(
                "Copied %s rows from articles_articleimageupload.",
                cursor.rowcount,
            )
            cursor.execute(
                "SELECT setval("
                "    pg_get_serial_sequence("
                "        'website_content_websitecontentimageupload', 'id'"
                "    ),"
                "    COALESCE("
                "        (SELECT MAX(id) FROM"
                "         website_content_websitecontentimageupload), 1"
                "    )"
                ")"
            )


def reverse_migration(apps, schema_editor):
    conn = schema_editor.connection
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT EXISTS ("
            "  SELECT 1 FROM information_schema.tables"
            "  WHERE table_name = 'articles_article'"
            ")"
        )
        if cursor.fetchone()[0]:
            cursor.execute(
                "DELETE FROM website_content_websitecontent"
                " WHERE id IN (SELECT id FROM articles_article)"
            )
        cursor.execute(
            "SELECT EXISTS ("
            "  SELECT 1 FROM information_schema.tables"
            "  WHERE table_name = 'articles_articleimageupload'"
            ")"
        )
        if cursor.fetchone()[0]:
            cursor.execute(
                "DELETE FROM website_content_websitecontentimageupload"
                " WHERE id IN (SELECT id FROM articles_articleimageupload)"
            )


class Migration(migrations.Migration):
    dependencies = [
        ("website_content", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(
            migrate_articles_to_website_content,
            reverse_migration,
        ),
    ]
