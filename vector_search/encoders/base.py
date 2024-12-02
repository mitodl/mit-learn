class BaseEncoder:
    def model_short_name(self):
        split_model_name = self.model_name.split("/")[1]
        if len(split_model_name) > 1:
            return split_model_name[1]
        return split_model_name
