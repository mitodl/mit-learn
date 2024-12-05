from abc import ABC, abstractmethod


class BaseEncoder(ABC):
    """
    Base encoder class
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

    def encode(self, text):
        """
        Embed a single text
        """
        return next(iter(self.encode_batch([text])))

    @abstractmethod
    def encode_batch(self, texts: list[str]) -> list[list[float]]:
        """
        Embed multiple texts
        """
        return [self.encode(text) for text in texts]

    def dim(self):
        """
        Return the dimension of the embeddings
        """
        return len(self.encode("test"))
