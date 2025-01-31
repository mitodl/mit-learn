from abc import ABC, abstractmethod

from langchain_core.embeddings import Embeddings


class BaseEncoder(Embeddings, ABC):
    """
    Base encoder class.
    Conforms to the langchain Embeddings interface
    """

    def model_short_name(self):
        """
        Return the short name of the model
        used as the vector name in qdrant
        """
        split_model_name = self.model_name.split("/")
        model_name = self.model_name
        if len(split_model_name) > 1:
            model_name = split_model_name[1]
        return model_name

    def embed(self, text):
        """
        Embed a single text
        """
        return next(iter(self.embed_documents([text])))

    def dim(self):
        """
        Return the dimension of the embeddings
        """
        return len(self.embed("test"))

    @abstractmethod
    def embed_documents(self, documents):
        """
        Embed a list of documents
        """

    def embed_query(self, query):
        """
        Embed a query
        """
        return self.embed(query)
