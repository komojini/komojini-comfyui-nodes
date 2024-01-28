
from server import PromptServer
import os

from .logger import logger


# wildcard trick is taken from pythongossss's
class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False

any_typ = AnyType("*")


HIDDEN_ARGS =  {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO", "unique_id": "UNIQUE_ID"}


def get_file_item(base_type, path):
    path_type = base_type

    if path == "[output]":
        path_type = "output"
        path = path[:-9]
    elif path == "[input]":
        path_type = "input"
        path = path[:-8]
    elif path == "[temp]":
        path_type = "temp"
        path = path[:-7]

    subfolder = os.path.dirname(path)
    filename = os.path.basename(path)

    return {
            "filename": filename,
            "subfolder": subfolder,
            "type": path_type
           }


def workflow_to_map(workflow):
    nodes = {}
    links = {}
    for link in workflow['links']:
        links[link[0]] = link[1:]
    for node in workflow['nodes']:
        nodes[str(node['id'])] = node

    return nodes, links


def collect_non_reroute_nodes(node_map, links, res, node_id):
    if node_map[node_id]['type'] != 'Reroute' and node_map[node_id]['type'] != 'Reroute (rgthree)':
        res.append(node_id)
    else:
        for link in node_map[node_id]['outputs'][0]['links']:
            next_node_id = str(links[link][2])
            collect_non_reroute_nodes(node_map, links, res, next_node_id)

from .cache_data import CACHED_MAP


class To:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"key": ("STRING", {"default": ""}),
                             },
                "optional": {"value": (any_typ, )}
                # "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO", "unique_id": "UNIQUE_ID"}
                }
    
    FUNCTION = "run"
    RETURN_TYPES = (any_typ, )
    RETURN_NAMES = ("*", )

    def run(self, key, **kwargs):
        if "*" in kwargs:
            value = kwargs["*"]
        elif "value" in kwargs:
            value = kwargs["value"]
        else:
            logger.warning(f"No value assigned for key: {key}, inputs: {kwargs}")

            value = next(iter(kwargs.values()))
        
        CACHED_MAP[key] = value;
        return (value, )


def run_getter(key, **kwargs):
    if "*" in kwargs:
        return (kwargs["*"], )
    elif "value" in kwargs:
        return (kwargs["value"], )

    else:
        for k, v in kwargs.items():
            if k in HIDDEN_ARGS:
                continue
            return (v, )
        logger.warning(f"No value assigned for key: {key}, inputs: {kwargs}")

    return None


class From:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"key": ("STRING", {"default": ""})},
                "optional" : {
                    "value": (any_typ, )
                },
                # "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO", "unique_id": "UNIQUE_ID"}
            }
    
    FUNCTION = "run"
    RETURN_TYPES = (any_typ, )
    RETURN_NAMES = ("*", )

    def run(self, key, **kwargs):
        return run_getter(key, **kwargs)
    

class ImageGetter:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"key": ("STRING", {"default": ""})},
                "optional" : {
                    "value": ("IMAGE", )
                },
                # "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO", "unique_id": "UNIQUE_ID"}
                }
    
    FUNCTION = "run"
    RETURN_TYPES = ("IMAGE", )
    RETURN_NAMES = ("*", )

    def run(self, key, **kwargs):
        return run_getter(key, **kwargs)


class CachedGetter:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"key": ("STRING", {"default": ""})},
                "optional" : {
                    "value": (any_typ, )
                },
                # "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO", "unique_id": "UNIQUE_ID"}
                }
    
    FUNCTION = "run"
    RETURN_TYPES = (any_typ, )
    RETURN_NAMES = ("*", )
    
    def run(self, key, **kwargs):
        cached_value = CACHED_MAP.get(key)
        if cached_value is not None:
            return (cached_value,)
        
        value = run_getter(key, **kwargs)[0]
        logger.info(f"There is no cached data for {key}. Caching new data...")
        CACHED_MAP[key] = value
        return (value, )
        

class FlowBuilder:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "value": (any_typ, ),
            },
            "optional": {
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 10000, "step": 1}),
            },
            "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO", "unique_id": "UNIQUE_ID"},
        }
    
    FUNCTION = "run"
    RETURN_TYPES = (any_typ, )
    RETURN_NAMES = ("value", )
    CATEGORY = "komojini/flow"

    def run(self, value, **kwargs):
        return (value, )


class FlowBuilderSetter:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "value": (any_typ,),
                "key": ("STRING", {"default": ""}),
            },
            "optional": {
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 10000, "step": 1}),
            },
            "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO", "unique_id": "UNIQUE_ID"},
        }
    
    FUNCTION = "run"
    RETURN_TYPES = (any_typ,)
    RETURN_NAMES = ("value",)
    CATEGORY = "komojini/flow"

    def run(self, **kwargs):
        key = kwargs.get("key")
        
        if "*" in kwargs:
            value = kwargs["*"]
        elif "value" in kwargs:
            value = kwargs["value"]
        else:
            logger.warning(f"No value assigned for key: {key}, inputs: {kwargs}")

            value = next(iter(kwargs.values()))
        
        CACHED_MAP[key] = value
        return (value, )
    

from PIL import Image, ImageOps
import torch
import base64
from io import BytesIO
import numpy as np



class DragNUWAImageCanvas:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("STRING", {"default": "[IMAGE DATA]"}),
                "tracking_points": ("STRING", {"default": "", "multiline": True})
            }
        }
    FUNCTION = "run"
    RETURN_TYPES = ("IMAGE", "STRING",)
    RETURN_NAMES = ("image", "tracking_points",)
    CATEGORY = "komojini/image"

    def run(self, image, tracking_points, **kwargs):
        logger.info(f"DragNUWA output of tracking points: {tracking_points}")
        
        # Extract the base64 string without the prefix
        base64_string = image.split(",")[1]

        # Decode base64 string to bytes
        i = base64.b64decode(base64_string)

        # Convert bytes to PIL Image
        i = Image.open(BytesIO(i))

        i = ImageOps.exif_transpose(i)
        image = i.convert("RGB")
        image = np.array(image).astype(np.float32) / 255.0
        image = torch.from_numpy(image)[None,]
        return (image, tracking_points, )


MAX_IMAGE_COUNT = 50

class BatchCreativeInterpolationNodeDynamicSettings:
    @classmethod
    def INPUT_TYPES(s):
        inputs = {
            "required": {
                "image_count": ("INT", {"default": 1, "min": 1, "max": MAX_IMAGE_COUNT, "step": 1}),
            },
        }

        for i in range(1, MAX_IMAGE_COUNT):
            if i == 1:
                inputs["required"][f"frame_distribution_{i}"] = ("INT", {"default": 4, "min": 4, "max": 64, "step": 1})
            else:
                inputs["required"][f"frame_distribution_{i}"] = ("INT", {"default": 16, "min": 4, "max": 64, "step": 1})
            
            inputs["required"][f"key_frame_influence_{i}"] = ("FLOAT", {"default": 1.0, "min": 0.0, "max": 10.0, "step": 0.1})
            inputs["required"][f"min_strength_value_{i}"] = ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.1})
            inputs["required"][f"max_strength_value_{i}"] = ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.1})

        return inputs
    
    RETURN_TYPES = ("STRING", "STRING", "STRING",)
    RETURN_NAMES = ("dynamic_frame_distribution_values", "dynamic_key_frame_influence_values", "dynamic_strength_values",)

    FUNCTION = "run"

    def run(self, image_count, **kwargs):
        dynamic_frame_distribution_values = ""
        dynamic_key_frame_influence_values = ""
        dynamic_strength_values = ""

        previous_frame_distribution = 0

        for i in range(1, image_count+1):
            previous_frame_distribution += kwargs.get(f"frame_distribution_{i}", 0)

            distribution_value = str(previous_frame_distribution) + ","
            influence_value = str(kwargs.get(f"key_frame_influence_{i}")) + ","
            strength_value = "({min},{max}),".format(min=kwargs.get(f"min_strength_value_{i}"), max=kwargs.get(f"max_strength_value_{i}"))
            
            dynamic_frame_distribution_values += distribution_value
            dynamic_key_frame_influence_values += influence_value
            dynamic_strength_values += strength_value

        return (dynamic_frame_distribution_values[:-1], dynamic_key_frame_influence_values[:-1], dynamic_strength_values[:-1],)
    
__all__ = [
    "To",
    "From",
    "ImageGetter",
    "CachedGetter",
    "FlowBuilder",
    "FlowBuilderSetter",
    "DragNUWAImageCanvas",
    "BatchCreativeInterpolationNodeDynamicSettings",
]