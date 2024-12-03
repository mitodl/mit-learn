from abc import ABC, abstractmethod


class BaseEncoder(ABC):
    def model_short_name(self):
        split_model_name = self.model_name.split("/")
        model_name = self.model_name
        if len(split_model_name) > 1:
            model_name = split_model_name[1]
        return model_name

    @abstractmethod
    def encode(self, text):
        pass

    @abstractmethod
    def encode_batch(self, text):
        pass

    def dim(self):
        return len(self.encode("test"))
