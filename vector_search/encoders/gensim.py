import gensim.downloader as api
import numpy as np

from vector_search.encoders.base import BaseEncoder


class GensimEncoder(BaseEncoder):
    """
    Lightweight local embedding encoder backed by gensim pretrained vectors.
    """

    def __init__(self, model_name="glove/glove-wiki-gigaword-50"):
        self.model_name = model_name
        self.model = api.load(self.model_short_name())

    def embed_documents(self, documents):
        return [self.embed(doc) for doc in documents]

    def embed(self, text):
        words = text.lower().split()
        vectors = [self.model[w] for w in words if w in self.model]
        if not vectors:
            return np.zeros(self.dim())
        return np.mean(vectors, axis=0)

    def dim(self):
        return self.model.vector_size
