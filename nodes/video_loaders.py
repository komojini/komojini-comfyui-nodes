from pytube import YouTube
from pytube.exceptions import VideoUnavailable
import cv2
import os
from pathlib import Path
from PIL import Image, ImageOps
from typing import Tuple, Dict, List, Any
import numpy as np

import torch
import subprocess
import folder_paths
from comfy.utils import common_upscale

from .utils import hash_path, validate_path, lazy_eval


video_extensions = ['webm', 'mp4', 'mkv', 'gif']

YOUTUBE_REQUIRED_INPUTS = {
                "youtube_url": ("STRING", {"default": ""}),
                "start_sec": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 10000.0, "step": 0.1}),
                "end_sec": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 10000.0, "step": 0.1}),
                "frame_load_cap": ("INT", {"default": 50, "min": 1, "max": 10000, "step": 1}),
            }

FILEPATH_REQUIRED_INPUTS = {
                "video": ("STRING", {"default": "X://insert/path/here.mp4", "vhs_path_extensions": video_extensions}),
                "force_rate": ("INT", {"default": 0, "min": 0, "max": 24, "step": 1}),
                "force_size": (["Disabled", "256x?", "?x256", "256x256", "512x?", "?x512", "512x512"],),
                "frame_load_cap": ("INT", {"default": 0, "min": 0, "step": 1}),
                "skip_first_frames": ("INT", {"default": 0, "min": 0, "step": 1}),
                "select_every_nth": ("INT", {"default": 1, "min": 1, "step": 1}),
            }


def target_size(width, height, force_size) -> tuple[int, int]:
    if force_size != "Disabled":
        force_size = force_size.split("x")
        if force_size[0] == "?":
            width = (width*int(force_size[1]))//height
            #Limit to a multple of 8 for latent conversion
            #TODO: Consider instead cropping and centering to main aspect ratio
            width = int(width)+4 & ~7
            height = int(force_size[1])
        elif force_size[1] == "?":
            height = (height*int(force_size[0]))//width
            height = int(height)+4 & ~7
            width = int(force_size[0])
        else:
            width = int(force_size[0])
            height = int(force_size[1])
    return (width, height)


def load_video_cv(
        video: str, 
        force_rate: int, 
        force_size: str, 
        frame_load_cap: int, 
        skip_first_frames: int, 
        select_every_nth: int,
        **kwargs,
    ) -> Tuple[torch.Tensor, int, int, int, int, bytes]:

    try:
        video_cap = cv2.VideoCapture(video)
        if not video_cap.isOpened():
            raise ValueError(f"{video} could not be loaded with cv.")
        # set video_cap to look at start_index frame
        images = []
        total_frame_count = 0
        total_frames_evaluated = -1
        frames_added = 0
        base_frame_time = 1/video_cap.get(cv2.CAP_PROP_FPS)
        width = video_cap.get(cv2.CAP_PROP_FRAME_WIDTH)
        height = video_cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        fps = int(video_cap.get(cv2.CAP_PROP_FPS))

        if force_rate == 0:
            target_frame_time = base_frame_time
        else:
            target_frame_time = 1/force_rate
        time_offset=target_frame_time - base_frame_time
        while video_cap.isOpened():
            if time_offset < target_frame_time:
                is_returned, frame = video_cap.read()
                # if didn't return frame, video has ended
                if not is_returned:
                    break
                time_offset += base_frame_time
            if time_offset < target_frame_time:
                continue
            time_offset -= target_frame_time
            # if not at start_index, skip doing anything with frame
            total_frame_count += 1
            if total_frame_count <= skip_first_frames:
                continue
            else:
                total_frames_evaluated += 1

            # if should not be selected, skip doing anything with frame
            if total_frames_evaluated%select_every_nth != 0:
                continue

            # opencv loads images in BGR format (yuck), so need to convert to RGB for ComfyUI use
            # follow up: can videos ever have an alpha channel?
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            # convert frame to comfyui's expected format (taken from comfy's load image code)
            image = Image.fromarray(frame)
            image = ImageOps.exif_transpose(image)
            image = np.array(image, dtype=np.float32) / 255.0
            image = torch.from_numpy(image)[None,]
            images.append(image)
            frames_added += 1
            # if cap exists and we've reached it, stop processing frames
            if frame_load_cap > 0 and frames_added >= frame_load_cap:
                break
    finally:
        video_cap.release()
    if len(images) == 0:
        raise RuntimeError("No frames generated")
    images = torch.cat(images, dim=0)
    if force_size != "Disabled":
        new_size = target_size(width, height, force_size)
        if new_size[0] != width or new_size[1] != height:
            s = images.movedim(-1,1)
            s = common_upscale(s, new_size[0], new_size[1], "lanczos", "center")
            images = s.movedim(1,-1)
    # TODO: raise an error maybe if no frames were loaded?

    #Setup lambda for lazy audio capture
    audio = lambda : get_audio(video, skip_first_frames * target_frame_time,
                               frame_load_cap*target_frame_time)
    
    return (images, frames_added, fps, width, height, lazy_eval(audio))


def is_gif(filename: Path | str) -> bool:
    return str(filename).endswith("gif")

def get_audio(file, start_time=0, duration=0):
    # TODO: set ffmpeg_path
    ffmpeg_path = ""
    args = [ffmpeg_path, "-v", "error", "-i", file]
    if start_time > 0:
        args += ["-ss", str(start_time)]
    if duration > 0:
        args += ["-t", str(duration)]
    return subprocess.run(args + ["-f", "wav", "-"],
                          stdout=subprocess.PIPE, check=True).stdout

def download_youtube_video(
        youtube_url: str,
        start_sec: float,
        end_sec: float,
        frame_load_cap: int = 50,
        output_dir = None,
        **kwargs,
    ):
    if not output_dir:
        output_dir = os.path.join(folder_paths.output_directory, "youtube")

    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    try:
        yt = YouTube(youtube_url)
        stream = yt.streams.filter(progressive=True, file_extension='mp4').order_by('resolution').desc().first()

        video_path = stream.download(output_dir)
        cap = cv2.VideoCapture(video_path)
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        # Calculate the total number of frames in the specified time range
        video_sec = end_sec - start_sec
        original_frame_length = video_sec * fps

        step = max(original_frame_length // frame_load_cap, 1)

        start_frame = fps * start_sec
        end_frame = fps * end_sec

        frames_added = 0
        images = []

        curr_frame = start_frame

        print(f"start_frame: {start_frame}\nend_frame: {end_frame}\nstep: {step}\n")

        while True:
            # Set the frame position
            cap.set(cv2.CAP_PROP_POS_FRAMES, curr_frame)

            ret, frame = cap.read()
            if not ret:
                break

            # Append the frame to the frames list
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            image = Image.fromarray(frame)
            image = ImageOps.exif_transpose(image)
            image = np.array(image, dtype=np.float32) / 255.0
            image = torch.from_numpy(image)[None,]
            images.append(image)
            frames_added += 1
            # if cap exists and we've reached it, stop processing frames
            if frame_load_cap > 0 and frames_added >= frame_load_cap:
                break
            if curr_frame >= end_frame:
                break

            curr_frame += step
    finally:
        
        # Release the video capture object
        cap.release()
    
    if len(images) == 0:
        raise RuntimeError("No frames generated")
    images = torch.cat(images, dim=0)
    
    #Setup lambda for lazy audio capture
    #audio = lambda : get_audio(video, skip_first_frames * target_frame_time, frame_load_cap*target_frame_time)
    return (images, frames_added, fps // step, width, height)


class YouTubeVideoLoader:
    @classmethod
    def INPUT_TYPES(s):

        return {
            "required": YOUTUBE_REQUIRED_INPUTS,
            "optional": {
                "output_dir": ("STRING", {"default": ""}),
            }
        }
    
    FUNCTION = "load_video"
    RETURN_TYPES = ("IMAGE", "INT", "INT", "INT", "INT",)
    RETURN_NAMES = ("IMAGE", "frame_count", "fps", "width", "height",)
    CATEGORY = "komojini/Video"
    
    def load_video(self, **kwargs):
        return download_youtube_video(**kwargs)


class UltimateVideoLoader:
    source = [
        "filepath",
        "YouTube",
    ]
    @classmethod
    def INPUT_TYPES(cls):
        inputs = {
            "required": {
                "source": (cls.source,),
            }
        }

        inputs["required"].update(YOUTUBE_REQUIRED_INPUTS)
        inputs["required"].update(FILEPATH_REQUIRED_INPUTS)

        # Just for visual purpose
        del inputs["required"]["frame_load_cap"]
        inputs["required"].update({"frame_load_cap": ("INT", {"default": 0, "min": 0, "max": 10000, "step": 1}),})

        return inputs

    FUNCTION = "load_video"
    RETURN_TYPES = ("IMAGE", "INT", "INT", "INT", "INT",)
    RETURN_NAMES = ("images", "frame_count", "fps", "width", "height",)
    CATEGORY = "komojini/Video"

    def load_video(self, **kwargs):
        source = kwargs.get("source")
        if source == "YouTube":
            images, frames_count, fps, width, height = download_youtube_video(**kwargs)
        elif source == "filepath":
            images, frames_count, fps, width, height, audio = load_video_cv(**kwargs)
        
        return (images, frames_count, fps, width, height,)

    @classmethod
    def IS_CHANGED(s, video, **kwargs):
        return hash_path(video)
    
    # @classmethod
    # def VALIDATE_INPUTS(s, video, force_size, **kwargs):
    #     return validate_path(video, allow_none=True)