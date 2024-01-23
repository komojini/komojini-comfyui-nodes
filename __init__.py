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
    "FlowBuilder (advanced)": FlowBuilder,
    "FlowBuilder (adv)": FlowBuilder,

    "FlowBuilderSetter": FlowBuilderSetter,
    "FlowBuilder (advanced) Setter": FlowBuilderSetter,
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
    "FlowBuilder (advanced)": END_EMOJI + "(adv) FlowBuilder", 
    "FlowBuilder (adv)": END_EMOJI + "(adv) FlowBuilder",

    "FlowBuilderSetter": END_EMOJI + "FlowBuilderSetter",
    "FlowBuilder (advanced) Setter": END_EMOJI + "(adv) FlowBuilderSetter",
    "FlowBuilderSetter (adv)": END_EMOJI + "(adv) FlowBuilder",

    "DragNUWAImageCanvas": "DragNUWAImageCanvas",
}


__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
]
