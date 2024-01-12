
from .youtube_nodes import YouTubeVideoLoader


NODE_CLASS_MAPPINGS = {
    "YouTubeVideoLoader": YouTubeVideoLoader
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "YouTubeVideoLoader": "YouTube Video Loader"
}

__all__ = [NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS]