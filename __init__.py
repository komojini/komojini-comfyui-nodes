
from .nodes import *
# import sys
# import os

# sys.path.insert(0, os.path.join(os.path.dirname(os.path.realpath(__file__)), "comfy"))


NODE_CLASS_MAPPINGS = {
    "YouTubeVideoLoader": YouTubeVideoLoader,
    "ImageMerger": ImageMerger,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "YouTubeVideoLoader": "YouTube Video Loader",
    "ImageMerger": "Image Merger"
}


__all__ = [
    "NODE_CLASS_MAPPINGS", 
    "NODE_DISPLAY_NAME_MAPPINGS",
]