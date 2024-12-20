from fastembed import TextEmbedding

from vector_search.encoders.base import BaseEncoder


class FastEmbedEncoder(BaseEncoder):
    """
    FastEmbed encoder
    """

    def __init__(self, model_name="BAAI/bge-small-en-v1.5"):
        self.model_name = model_name
        self.model = TextEmbedding(model_name=model_name, lazy_load=True)

    def encode_batch(self, texts: list[str]) -> list[list[float]]:
        return self.model.embed(texts)

    def dim(self):
        """
        Return the dimension of the embeddings
        """
        supported_models = [
            model_config
            for model_config in self.model.list_supported_models()
            if model_config["model"] == self.model.model_name
        ]
        return supported_models[0]["dim"]
