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

    def prune_sparse_vector(self, vec, max_terms=None):
        """
        Drop entries that carry no lexical signal, and optionally cap the
        number of terms retained.

        Only exact zeros are dropped: with alternate_sign enabled, colliding
        terms can cancel to 0.0 and contribute nothing to the dot product.
        Document length is already bounded upstream by truncation to the
        embedding model's input limit; max_terms is available as a backstop if
        the sparse index ever needs a harder bound.
        """
        pairs = [(i, v) for i, v in zip(vec["indices"], vec["values"]) if v != 0]
        if max_terms is not None and len(pairs) > max_terms:
            pairs = sorted(pairs, key=lambda pair: (-abs(pair[1]), pair[0]))[:max_terms]
        return {
            "indices": [i for i, _ in pairs],
            "values": [v for _, v in pairs],
        }

    def embed_documents(self, documents):
        return [self.embed(doc) for doc in documents]

    def embed(self, text):
        tfidf_matrix = self.vectorizer.transform([text])
        indices = tfidf_matrix.indices.tolist()
        values = tfidf_matrix.data.tolist()
        return models.SparseVector(
            **self.prune_sparse_vector({"indices": indices, "values": values})
        )

    def dim(self):
        """
        Return the dimension of the embeddings
        """
        return 0
