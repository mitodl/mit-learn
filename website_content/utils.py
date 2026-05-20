"""website_content utilities"""

from main.utils import generate_filepath


def website_content_image_upload_uri(_, filename):
    """
    upload_to handler for WebsiteContentImageUpload.image_file
    """
    return generate_filepath(filename, "", "", "website_content")
