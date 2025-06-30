from fastembed import SparseTextEmbedding, TextEmbedding

from vector_search.encoders.base import BaseEncoder


class FastEmbedEncoder(BaseEncoder):
    """
    FastEmbed encoder
    """

    def __init__(self, model_name="BAAI/bge-small-en-v1.5"):
        supported_models = [
            model["model"] for model in TextEmbedding.list_supported_models()
        ]
        self.model_name = model_name

        if model_name in supported_models:
            self.model = TextEmbedding(model_name=model_name, lazy_load=True)
        else:
            self.model = SparseTextEmbedding(model_name=model_name, lazy_load=True)

    def embed_documents(self, documents):
        return list(self.model.embed(documents, parallel=0))

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
