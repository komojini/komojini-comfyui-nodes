
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
            "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO", "unique_id": "UNIQUE_ID"},
        }
    
    FUNCTION = "run"
    RETURN_TYPES = (any_typ, )
    RETURN_NAMES = ("value", )
    CATEGORY = "komojini/flow"

    def run(self, value, prompt, extra_pnginfo, unique_id):
        return (value, )


class FlowBuilderSetter:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "value": (any_typ,),
                "key": ("STRING", {"default": ""}),
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


__all__ = [
    "To",
    "From",
    "ImageGetter",
    "CachedGetter",
    "FlowBuilder",
    "FlowBuilderSetter",
    "DragNUWAImageCanvas",
]