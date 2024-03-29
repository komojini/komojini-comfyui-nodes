import cv2
import os
import numpy as np
import torch
from typing import Tuple, Optional


def tensor_to_int(tensor, bits):
    #TODO: investigate benefit of rounding by adding 0.5 before clip/cast
    tensor = tensor.cpu().numpy() * (2**bits-1)
    return np.clip(tensor, 0, (2**bits-1))
def tensor_to_shorts(tensor):
    return tensor_to_int(tensor, 16).astype(np.uint16)
def tensor_to_bytes(tensor):
    return tensor_to_int(tensor, 8).astype(np.uint8)

def line_equation(x1, y1, x2, y2, x, y):
    return (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)

def line_mask_equation(x1, y1, x2, y2, x, y, size):
    distance = np.abs((x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)) / np.sqrt((y2 - y1)**2 + (x2 - x1)**2)
    return distance <= size / 2

def merge_images(images1, images2, x1, y1, x2, y2, line_thickness):
    batch_size, height, width, channels = images1.shape

    # Create 2D grid of (x, y) coordinates
    y_coords, x_coords = torch.meshgrid(torch.arange(height), torch.arange(width))
    coords = torch.stack([x_coords, y_coords], dim=-1)

    # Calculate line equation for each point in the grid
    line_values = line_equation(x1, y1, x2, y2, coords[..., 0], coords[..., 1])

    # Create a mask based on the line equation
    mask = line_values > 0

    # Broadcast the mask to the shape of the images
    mask = mask.unsqueeze(0).unsqueeze(3).expand(batch_size, height, width, channels)

    # Combine the corresponding regions from each image
    merged_images = images1 * mask.float() + images2 * (~mask).float()
    
    if line_thickness:
        try:
            line_mask_values = line_mask_equation(x1, y1, x2, y2, coords[..., 0], coords[..., 1], line_thickness)
            line_mask_values = line_mask_values.unsqueeze(0).unsqueeze(3).expand(batch_size, height, width, channels)
            merged_images = merged_images * (~line_mask_values).float() + line_mask_values.float()
        except Exception as e:
            print(e)
            
    return merged_images


class ImageMerger:
    @classmethod
    def INPUT_TYPES(s):

        return {
            "required": {
                "images_1": ("IMAGE",),
                "images_2": ("IMAGE",),
                "divide_points": ("STRING", {"default": "(50%, 0);(50%, 100%)"}),
                "line_thickness": ("INT", {"default": 0, "min": 0, "max": 1000, "step": 1}),
            },
        }
    
    FUNCTION = "merge_video"
    CATEGORY = "komojini/Image"
    RETURN_NAMES = ("images", "num_images",)
    RETURN_TYPES = ("IMAGE", "INT",)

    def merge_video(self, images_1, images_2, divide_points, line_thickness):
        # image.shape = (num_imgs, height, width, channels)
        num_images, height, width, _ = images_1.shape
        print(f"start merge images, images_1.shape: {images_1.shape}")
        marks = []
        for mark_string in divide_points.split(";"):
            xy = self.get_xy(mark_string, height, width)
            if not xy:
                continue
            marks.append(xy)
        
        # TODO: implement using more than 2 marks.
        if len(marks) != 2:
            raise NotImplemented("currently only 2 marks are available.")

        else:
            x1, y1 = marks[0]
            x2, y2 = marks[1]
            merged_images = merge_images(
                images1=images_1,
                images2=images_2,
                x1=x1, y1=y1, x2=x2, y2=y2,
                line_thickness=line_thickness,
            )

        print(f"merged_images.shape: {merged_images.shape}")
        return (merged_images, len(merged_images))


    @staticmethod
    def get_xy(mark_string: str, height: int, width: int) -> Optional[Tuple[int, int]]:
        mark_string = mark_string.strip()
        if not mark_string.startswith("(") or not mark_string.endswith(")"):
            print(f"mark_string is not appropriate, mark_string: {mark_string}")
            return None
        mark_string = mark_string[1:-1]
        x, y = mark_string.split(",")
        x, y = x.strip(), y.strip()
        if x.endswith("%"):
            x = x[:-1]
            x = int(x)
            x = int(width * x / 100)
        else:
            x = int(x)

        if y.endswith("%"):
            y = y[:-1]
            y = int(y)
            y = int(height * y / 100)
        else:
            y = int(y)
        
        return x, y
