from pytube import YouTube
from pytube.exceptions import VideoUnavailable
import cv2
import os
from pathlib import Path
from PIL import Image, ImageOps
import numpy as np

import torch
import subprocess
import folder_paths


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
    
    def load_video(
            self,
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
        except VideoUnavailable as e:
            raise e
        
        finally:
            
            # Release the video capture object
            cap.release()
        
        if len(images) == 0:
            raise RuntimeError("No frames generated")
        images = torch.cat(images, dim=0)
        
        #Setup lambda for lazy audio capture
        #audio = lambda : get_audio(video, skip_first_frames * target_frame_time, frame_load_cap*target_frame_time)
        return (images, frames_added, fps // step, width, height)


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
            raise NotImplemented
        
        return (images, frames_count, fps, width, height,)
