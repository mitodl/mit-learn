from rest_framework_transforms.transforms import BaseTransform


class LearningResourceTransform0002(BaseTransform):
    def backwards(self, data, request, instance):
        data["learning_format"] = data["delivery"]
        data.pop("delivery")
        return data


class LearningResourceTransform0001(BaseTransform):
    def forwards(self, data, request):
        if "learning_format" in data:
            data["delivery"] = data["learning_format"]
            data.pop("learning_format")
        return data
