
from .nodes import *
import folder_paths
from .server import server

WEB_DIRECTORY = "js"


NODE_CLASS_MAPPINGS = {
    "YouTubeVideoLoader": YouTubeVideoLoader,
    "ImageMerger": ImageMerger,
    "UltimateVideoLoader": UltimateVideoLoader,
    "UltimateVideoLoader (simple)": UltimateVideoLoader,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "YouTubeVideoLoader": "YouTube Video Loader",
    "ImageMerger": "Image Merger",
    "UltimateVideoLoader": "🎥Ultimate Video Loader🎥",
    "UltimateVideoLoader (simple)": "🎥Ultimate Video Loader (simple)🎥",
}


__all__ = [
    "NODE_CLASS_MAPPINGS", 
    "NODE_DISPLAY_NAME_MAPPINGS",
]