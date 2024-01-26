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

from .logger import logger


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
            height = width / target_ratio


        x = round((ow - width) / 2)
        y = round((oh - height) / 2)
        width, height = round(width), round(height)


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
                        "center",
                        "top",
                        "right",
                        "bottom",
                        "left",
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
            height = width / target_ratio


        x = round((ow - width) / 2)
        y = round((oh - height) / 2)
        width, height = round(width), round(height)

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

        width = width_ratio_size
        height = height_ratio_size

        outputs = p(image)
        if interpolation == "lanczos":
            outputs = comfy.utils.lanczos(outputs, width, height)
        else:
            outputs = F.interpolate(outputs, size=(height, width), mode=interpolation)
        outputs = pb(outputs)

        return(outputs, outputs.shape[2], outputs.shape[1],)



class ImagesCropByRatioAndResizeBatch(ImageCropByRatioAndResize):


    FUNCTION = "list_execute"
    INPUT_IS_LIST = True
    OUTPUT_IS_LIST = (False, False, False,)

    def list_execute(self, image, **kwargs):
        logger.debug(f"{len(image)}, {kwargs}")

        output_images = []
        new_kwargs = {}
        for k, v in kwargs.items():
            if isinstance(v, list):
                new_kwargs[k] = v[0]
        
        width, height = new_kwargs["width_ratio_size"], new_kwargs["height_ratio_size"]

        for img in image:
            output_img, width, height = super().execute(img, **new_kwargs)
            output_images.append(output_img)

        if len(output_images) <= 1:
            return (output_images[0], width, height,)
        
        output_images = torch.cat(output_images, dim=0)

        return (output_images, width, height, )


__all__ = [
    "ImageCropByRatio",
    "ImageCropByRatioAndResize",
    "ImagesCropByRatioAndResizeBatch",
]