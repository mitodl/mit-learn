from qdrant_client import models
from sklearn.feature_extraction.text import HashingVectorizer

from vector_search.encoders.base import BaseEncoder


class SparseHashEncoder(BaseEncoder):
    """
    Sparse Hash Encoder
    """

    def __init__(self, model_name="sklearn/hashing_vectorizer_sparse_model"):
        self.model_name = model_name
        self.vectorizer = HashingVectorizer(stop_words="english")

    def prune_sparse_vector(self, vec, threshold=0.1):
        return {
            "indices": [
                i for i, v in zip(vec["indices"], vec["values"]) if abs(v) > threshold
            ],
            "values": [v for v in vec["values"] if abs(v) > threshold],
        }

    def embed_documents(self, documents):
        return [models.SparseVector(**self.embed(doc)) for doc in documents]

    def embed(self, text):
        tfidf_matrix = self.vectorizer.transform([text])
        indices = tfidf_matrix.indices.tolist()
        values = tfidf_matrix.data.tolist()
        return self.prune_sparse_vector({"indices": indices, "values": values})

    def dim(self):
        """
        Return the dimension of the embeddings
        """
        return 0
