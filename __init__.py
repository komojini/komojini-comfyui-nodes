from .nodes import *
import folder_paths
from .komojini_server import server

WEB_DIRECTORY = "js"

END_EMOJI = "🔥"

NODE_CLASS_MAPPINGS = {
    "YouTubeVideoLoader": YouTubeVideoLoader,
    "ImageMerger": ImageMerger,
    "UltimateVideoLoader": UltimateVideoLoader,
    "UltimateVideoLoader (simple)": UltimateVideoLoader,
    "KSamplerCacheable": KSamplerCacheable,
    "KSamplerAdvancedCacheable": KSamplerAdvancedCacheable,
    "Setter": To,
    "Getter": From,
    "ImageGetter": ImageGetter,
    "FlowBuilder": FlowBuilder,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "YouTubeVideoLoader": "YouTube Video Loader",
    "ImageMerger": "Image Merger",
    "UltimateVideoLoader": "🎥Ultimate Video Loader🎥",
    "UltimateVideoLoader (simple)": "🎥Ultimate Video Loader (simple)🎥",
    "KSamplerCacheable": "KSampler (cacheable)",
    "KSamplerAdvancedCacheable": "KSamplerAdvanced (cacheable)",
    "Setter": "Setter",
    "Getter": "Getter",
    "ImageGetter": "ImageGetter",
    "FlowBuilder": "FlowBuilder " + END_EMOJI,
}


__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
]
