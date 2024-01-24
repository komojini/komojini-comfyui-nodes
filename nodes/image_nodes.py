import warnings
warnings.filterwarnings('ignore', module="torchvision")
import ast
import math
import random
import operator as op
import numpy as np

import torch
import torch.nn.functional as F

import torchvision.transforms.v2 as T

import comfy.utils


MAX_RESOLUTION = 8192

def p(image):
    return image.permute([0,3,1,2])
def pb(image):
    return image.permute([0,2,3,1])


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
                        "top",
                        "right",
                        "bottom",
                        "left",
                        "center",
                    ],
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
        "width",
        "height",
    )
    FUNCTION = "execute"
    CATEGORY = "essentials"

    def execute(self, image, width_ratio, height_ratio, position):
        _, oh, ow, _ = image.shape

        image_ratio = ow / oh
        target_ratio = width_ratio / height_ratio

        if image_ratio > target_ratio:
            height = oh
            width = target_ratio * height
        else:
            width = ow
            height = target_ratio * width

        width, height = int(width), int(height)

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
            width,
            height,
        )



class ImageCropByRatioAndResize:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image": ("IMAGE",),
                "width_ratio_size": ("INT", {"default": 512, "min": 1, "max": MAX_RESOLUTION}),
                "height_ratio_size": (
                    "INT",
                    {"default": 512, "min": 1, "max": MAX_RESOLUTION},
                ),
                "position": (
                    [
                        "top",
                        "right",
                        "bottom",
                        "left",
                        "center",
                    ],
                ),
                "interpolation": (["nearest", "bilinear", "bicubic", "area", "nearest-exact", "lanczos"],),                
                
            }
        }

    RETURN_TYPES = (
        "IMAGE",
        "INT",
        "INT",
    )
    RETURN_NAMES = (
        "IMAGE",
        "width",
        "height",
    )
    FUNCTION = "execute"
    CATEGORY = "essentials"

    def execute(self, image, width_ratio_size, height_ratio_size, position, interpolation):
        _, oh, ow, _ = image.shape

        image_ratio = ow / oh
        target_ratio = width_ratio_size / height_ratio_size

        if image_ratio > target_ratio:
            height = oh
            width = target_ratio * height
        else:
            width = ow
            height = target_ratio * width

        width, height = int(width), int(height)

        # if "center" in position:
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


        size_ratio = width_ratio_size / ow

        outputs = p(image)
        if interpolation == "lanczos":
            outputs = comfy.utils.lanczos(outputs, width, height)
        else:
            outputs = F.interpolate(outputs, size=(height, width), mode=interpolation)
        outputs = pb(outputs)

        return(outputs, outputs.shape[2], outputs.shape[1],)
    