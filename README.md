# komojini-comfyui-nodes
Custom ComfyUI Nodes for video generation

## Nodes
### YouTube Video Loader
<img width="50%" alt="Youtube video loader" src="https://github.com/komojini/komojini-comfyui-nodes/assets/118584718/cc99ea6f-e9ac-462d-abb9-ee6b11c0f381"><br>
Able to load and extract video from youtube.

Args:
- youtube_url
- start_sec
- end_sec
- frame_load_cap: max frames to be returned, the fps will be changed automatically by durations and frame count. This will not increase the frame count of the original video.
- output_dir (optional)

### Image Merger
Able to merge 2 images or videos side by side.
Useful to see the results of img2img or vid2vid.

divide_points: 2 points that creates a line to be splitted.
One point will be like (x, y) and the points should be seperated by ";".
for "x" and "y", you can use int (pixel) or with %.
e.g. 
- (50%, 0);(50%, 100%) -> split by vertical line in the center
- (0%, 50%);(100%, 50%) -> split by horizontal line in the center
- (40%, 0);(70%, 100%) ->

<img width="80%" src="https://github.com/komojini/komojini-comfyui-nodes/assets/118584718/8839b1da-e5c1-41a9-87e4-514e25e113b5"/>

<img width="80%" src="https://github.com/komojini/komojini-comfyui-nodes/assets/118584718/585b46d7-2a73-4cc2-be29-68d02db0fe1c"/>

