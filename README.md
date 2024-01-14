# komojini-comfyui-nodes
Custom ComfyUI Nodes for video generation

## Video Loading Nodes
### Ultimate Video Loader
Able to load video from several sources (filepath, YouTube, etc.)<br>
3 source types available: 
- file path
- file upload
- youtube <br><br>
![image](https://github.com/komojini/komojini-comfyui-nodes/assets/118584718/a69344f6-eb5e-4335-a44e-84125a7a517b)


Common Args:
- start_sec: float
- end_sec: float (0.0 -> end of the video)
- max_fps: int (0 or -1 to disable)
- force_size
- frame_load_cap: max frames to be returned, the fps will be automatically changed by the duration and frame count. This will not increase the frame count of the original video (will not increase original fps).
<br>
The video downloaded from YouTube will be saved in "path-to-comfyui/output/youtube/" (will be changed later)

### YouTube Video Loader
<img width="50%" alt="Youtube video loader" src="https://github.com/komojini/komojini-comfyui-nodes/assets/118584718/65142191-f7e9-4341-ba47-4226b31451fd"><br>
Able to load and extract video from youtube.

Args:
- Common Args Above...
- output_dir (optional): defaults to "path-to-comfyui/output/youtube/"

## Others
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

