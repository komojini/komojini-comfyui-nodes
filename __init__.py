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
    "FlowBuilder (adv)": FlowBuilder,

    "FlowBuilderSetter": FlowBuilderSetter,
    "FlowBuilderSetter (adv)": FlowBuilderSetter,

    "CachedGetter": CachedGetter,
    "DragNUWAImageCanvas": DragNUWAImageCanvas,
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
    "CachedGetter": "CachedGetter",
    "ImageGetter": "ImageGetter",
    "FlowBuilder": END_EMOJI + " FlowBuilder",   
    "FlowBuilder (adv)": END_EMOJI + " FlowBuilder (adv)", 
    "FlowBuilderSetter": END_EMOJI + "FlowBuilderSetter",
    "FlowBuilderSetter (adv)": END_EMOJI + "FlowBuilderSetter (adv)",
    "DragNUWAImageCanvas": "DragNUWAImageCanvas",
}


__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
]
