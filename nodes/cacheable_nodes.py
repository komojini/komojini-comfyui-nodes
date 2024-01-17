import os
import functools

import comfy
import folder_paths
from nodes import common_ksampler, KSampler
from .logger import logger
from .utils import to_hashable, hashable_to_dict


CACHE_MAX_SIZE = 4

def to_cacheable_function(func: callable, maxsize=CACHE_MAX_SIZE, typed=False):
    
    @functools.lru_cache(maxsize=maxsize, typed=typed)
    def cacheable_function(kwargs):
        kwargs = hashable_to_dict(kwargs)
        return func(**kwargs)
    
    return cacheable_function


class KSamplerCacheable(KSampler):
    def __init__(self):
        super().__init__()
        self.call = to_cacheable_function(super().sample)

    FUNCTION = "cache_call"
    def cache_call(self, **kwargs):
        kwargs = to_hashable(kwargs)
        return self.call(kwargs)


class KSamplerAdvancedCacheable:
    def __init__(self):
        self.call = to_cacheable_function(common_ksampler)

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "model": ("MODEL",),
                "add_noise": (["enable", "disable"],),
                "noise_seed": (
                    "INT",
                    {"default": 0, "min": 0, "max": 0xFFFFFFFFFFFFFFFF},
                ),
                "steps": ("INT", {"default": 20, "min": 1, "max": 10000}),
                "cfg": (
                    "FLOAT",
                    {
                        "default": 8.0,
                        "min": 0.0,
                        "max": 100.0,
                        "step": 0.1,
                        "round": 0.01,
                    },
                ),
                "sampler_name": (comfy.samplers.KSampler.SAMPLERS,),
                "scheduler": (comfy.samplers.KSampler.SCHEDULERS,),
                "positive": ("CONDITIONING",),
                "negative": ("CONDITIONING",),
                "latent_image": ("LATENT",),
                "start_at_step": ("INT", {"default": 0, "min": 0, "max": 10000}),
                "end_at_step": ("INT", {"default": 10000, "min": 0, "max": 10000}),
                "return_with_leftover_noise": (["disable", "enable"],),
            }
        }

    RETURN_TYPES = ("LATENT",)
    FUNCTION = "sample"

    CATEGORY = "komojini/sampling"

    def sample(
        self,
        model,
        add_noise,
        noise_seed,
        steps,
        cfg,
        sampler_name,
        scheduler,
        positive,
        negative,
        latent_image,
        start_at_step,
        end_at_step,
        return_with_leftover_noise,
        denoise=1.0,
    ):
        force_full_denoise = True
        if return_with_leftover_noise == "enable":
            force_full_denoise = False
        disable_noise = False
        if add_noise == "disable":
            disable_noise = True

        kwargs = {
            "model": model,
            "seed": noise_seed,
            "steps": steps,
            "cfg": cfg,
            "sampler_name": sampler_name,
            "scheduler": scheduler,
            "positive": positive,
            "negative": negative,
            "latent": latent_image,
            "denoise": denoise,
            "disable_noise": disable_noise,
            "start_step": start_at_step,
            "last_step": end_at_step,
            "force_full_denoise": force_full_denoise,
        }
        kwargs = to_hashable(kwargs)

        return self.call(kwargs)
