MAX_RESOLUTION = 8192


class ImageCropByRatio:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image": ("IMAGE",),
                "width_ratio": ("INT", {"default": 1, "min": 1, "max": MAX_RESOLUTION}),
                "height_ratio": (
                    "INT",
                    {"default": 1, "min": 1, "max": MAX_RESOLUTION},
                ),
                "position": (
                    [
                        "top-left",
                        "top-center",
                        "top-right",
                        "right-center",
                        "bottom-right",
                        "bottom-center",
                        "bottom-left",
                        "left-center",
                        "center",
                    ],
                ),
                "x_offset": (
                    "INT",
                    {
                        "default": 0,
                        "min": -99999,
                        "step": 1,
                    },
                ),
                "y_offset": (
                    "INT",
                    {
                        "default": 0,
                        "min": -99999,
                        "step": 1,
                    },
                ),
            }
        }

    RETURN_TYPES = (
        "IMAGE",
        "INT",
        "INT",
    )
    RETURN_NAMES = (
        "IMAGE",
        "x",
        "y",
    )
    FUNCTION = "execute"
    CATEGORY = "essentials"

    def execute(self, image, width_ratio, height_ratio, position, x_offset, y_offset):
        _, oh, ow, _ = image.shape

        image_ratio = ow / oh
        target_ratio = width_ratio / height_ratio

        if image_ratio > target_ratio:
            height = oh
            width = target_ratio * height
        else:
            width = ow
            height = target_ratio * width

        if "center" in position:
            x = round((ow - width) / 2)
            y = round((oh - height) / 2)
        if "top" in position:
            y = 0
        if "bottom" in position:
            y = oh - height
        if "left" in position:
            x = 0
        if "right" in position:
            x = ow - width

        x += x_offset
        y += y_offset

        x2 = x + width
        y2 = y + height

        if x2 > ow:
            x2 = ow
        if x < 0:
            x = 0
        if y2 > oh:
            y2 = oh
        if y < 0:
            y = 0

        image = image[:, y:y2, x:x2, :]

        return (
            image,
            x,
            y,
        )
