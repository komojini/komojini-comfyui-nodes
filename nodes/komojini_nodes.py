
from server import PromptServer
import os

from .logger import logger


# wildcard trick is taken from pythongossss's
class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False

any_typ = AnyType("*")


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


MAPPED_VALUES = {}


class To:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"key": ("STRING", {"default": ""}),
                             "value": (any_typ, )},
                "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO", "unique_id": "UNIQUE_ID"}}
    
    FUNCTION = "run"
    RETURN_TYPES = (any_typ, )
    RETURN_NAMES = ("value", )

    def run(self, key, value, prompt=None, extra_pnginfo=None, unique_id=None):
        # PromptServer.instance.send_sync("img-send", {"link_id": link_id, "images": result['ui']['images']})
        MAPPED_VALUES[key] = value
        return (value, )

class From:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"key": ("STRING", {"default": ""})},
                "optional" : {
                    "value": (any_typ, )
                },
                "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO", "unique_id": "UNIQUE_ID"}}
    
    FUNCTION = "run"
    RETURN_TYPES = (any_typ, )
    RETURN_NAMES = ("value", )

    def run(self, key, value=None, prompt=None, extra_pnginfo=None, unique_id=None):
        if value is None:
            logger.warning(f"No signal_opt assigned for id: {key}")
            return MAPPED_VALUES.get(key)
        return (value, )