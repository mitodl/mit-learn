from django.conf import settings
from openai import OpenAI

from learning_resources_search.encoders.base import BaseEncoder

OPENAI_MODEL_DIMENSIONS = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
}


class OpenAIEncoder(BaseEncoder):
    def __init__(self, model_name="text-embedding-3-small"):
        self.model_name = model_name
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.info = self.client.models.retrieve(self.model_name)

    def encode(self, text: str) -> list:
        return (
            self.client.embeddings.create(model=self.model_name, input=[text])
            .data[0]
            .embedding
        )

    def encode_batch(self, texts: list[str]) -> list[list[float]]:
        return [
            record.embedding
            for record in self.client.embeddings.create(
                model=self.model_name, input=texts
            ).data
        ]

    def dim(self):
        return OPENAI_MODEL_DIMENSIONS.get(self.model_name, 0)
