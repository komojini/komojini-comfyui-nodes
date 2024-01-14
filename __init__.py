
from .nodes import *

WEB_DIRECTORY = "js"


NODE_CLASS_MAPPINGS = {
    "YouTubeVideoLoader": YouTubeVideoLoader,
    "ImageMerger": ImageMerger,
    "UltimateVideoLoader": UltimateVideoLoader,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "YouTubeVideoLoader": "YouTube Video Loader",
    "ImageMerger": "Image Merger",
    "UltimateVideoLoader": "UltimateVideoLoader",
}


__all__ = [
    "NODE_CLASS_MAPPINGS", 
    "NODE_DISPLAY_NAME_MAPPINGS",
]