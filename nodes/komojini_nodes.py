
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
            logger.warning(f"No signal_opt assigned for key: {key}")
        return (value, )
    

class ImageGetter:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"key": ("STRING", {"default": ""})},
                "optional" : {
                    "value": ("IMAGE", )
                },
                "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO", "unique_id": "UNIQUE_ID"}}
    
    FUNCTION = "run"
    RETURN_TYPES = ("IMAGE", )
    RETURN_NAMES = ("value", )

    def run(self, key, value=None, prompt=None, extra_pnginfo=None, unique_id=None):
        if value is None:
            logger.warning(f"No signal_opt assigned for key: {key}")
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
    