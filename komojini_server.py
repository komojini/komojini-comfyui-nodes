import server
import folder_paths
import os
import time
import psutil
import GPUtil
import subprocess

from .nodes.utils import is_url, get_sorted_dir_files_from_directory, ffmpeg_path
from comfy.k_diffusion.utils import FolderOfImages
import nodes

DEBUG = True

from pprint import pprint

def print_info(info):
    pprint(f"🔥 - {info}")

web = server.web

def is_safe(path):
    if "KOMOJINI_STRICT_PATHS" not in os.environ:
        return True
    basedir = os.path.abspath('.')
    try:
        common_path = os.path.commonpath([basedir, path])
    except:
        #Different drive on windows
        return False
    return common_path == basedir


@server.PromptServer.instance.routes.get("/komojini/systemstatus")
async def get_system_status(request):
    system_status = {
        "cpu": None,
        "gpus": None,
        "cpustats": None,
        "virtual_memory": dict(psutil.virtual_memory()._asdict()), # {'total': 66480500736, 'available': 61169692672, 'percent': 8.0, 'used': 4553539584, 'free': 41330143232, 'active': 13218308096, 'inactive': 10867519488, 'buffers': 374468608, 'cached': 20222349312, 'shared': 15781888, 'slab': 567083008}
    }

    # Get CPU usage
    cpu_usage = psutil.cpu_percent(interval=1)
    cpu_stats = psutil.cpu_stats() # scpustats(ctx_switches=17990329, interrupts=17614856, soft_interrupts=10633860, syscalls=0)
    cpu_times_percent = psutil.cpu_times_percent()
    cpu_count = psutil.cpu_count()


    # system_status["cpustats"] = cpu.__dict__
    system_status['cpu'] = {
        "cpu_usage": cpu_usage,
        "cpu_times_percent": cpu_times_percent,
        "cpu_count": cpu_count,
    }
    # Get GPU usage
    try:
        gpu = GPUtil.getGPUs()[0]  # Assuming you have only one GPU
        gpus = GPUtil.getGPUs()
        system_status["gpus"] = [gpu.__dict__ for gpu in gpus]

    except Exception as e:
        system_status['gpus'] = None  # Handle the case where GPU information is not available

    return web.json_response(system_status)


@server.PromptServer.instance.routes.get("/komojini/debug")
async def get_debug(request):
    return web.json_response({"enabled": True})


@server.PromptServer.instance.routes.get("/komojini/onqueue")
async def on_queue(request):
    pass

@server.PromptServer.instance.routes.get("/viewvideo")
async def view_video(request):
    query = request.rel_url.query
    if "filename" not in query:
        return web.Response(status=404)
    filename = query["filename"]

    #Path code misformats urls on windows and must be skipped
    if is_url(filename):
        file = filename
    else:
        filename, output_dir = folder_paths.annotated_filepath(filename)

        type = request.rel_url.query.get("type", "output")
        if type == "path":
            #special case for path_based nodes
            #NOTE: output_dir may be empty, but non-None
            output_dir, filename = os.path.split(filename)
        if output_dir is None:
            output_dir = folder_paths.get_directory_by_type(type)

        if output_dir is None:
            return web.Response(status=400)

        if not is_safe(output_dir):
            return web.Response(status=403)

        if "subfolder" in request.rel_url.query:
            output_dir = os.path.join(output_dir, request.rel_url.query["subfolder"])

        filename = os.path.basename(filename)
        file = os.path.join(output_dir, filename)

        if query.get('format', 'video') == 'folder':
            if not os.path.isdir(file):
                return web.Response(status=404)
        else:
            if not os.path.isfile(file):
                return web.Response(status=404)

    if query.get('format', 'video') == "folder":
        #Check that folder contains some valid image file, get it's extension
        #ffmpeg seems to not support list globs, so support for mixed extensions seems unfeasible
        os.makedirs(folder_paths.get_temp_directory(), exist_ok=True)
        concat_file = os.path.join(folder_paths.get_temp_directory(), "image_sequence_preview.txt")
        skip_first_images = int(query.get('skip_first_images', 0))
        select_every_nth = int(query.get('select_every_nth', 1))
        valid_images = get_sorted_dir_files_from_directory(file, skip_first_images, select_every_nth, FolderOfImages.IMG_EXTENSIONS)
        if len(valid_images) == 0:
            return web.Response(status=400)
        with open(concat_file, "w") as f:
            f.write("ffconcat version 1.0\n")
            for path in valid_images:
                f.write("file '" + os.path.abspath(path) + "'\n")
                f.write("duration 0.125\n")
        in_args = ["-safe", "0", "-i", concat_file]
    else:
        in_args = ["-an", "-i", file]

    args = [ffmpeg_path, "-v", "error"] + in_args
    vfilters = []
    if int(query.get('force_rate',0)) != 0:
        vfilters.append("fps=fps="+query['force_rate'] + ":round=up:start_time=0.001")
    if int(query.get('skip_first_frames', 0)) > 0:
        vfilters.append(f"select=gt(n\\,{int(query['skip_first_frames'])-1})")
    if int(query.get('select_every_nth', 1)) > 1:
        vfilters.append(f"select=not(mod(n\\,{query['select_every_nth']}))")
    if query.get('force_size','Disabled') != "Disabled":
        size = query['force_size'].split('x')
        if size[0] == '?' or size[1] == '?':
            size[0] = "-2" if size[0] == '?' else f"'min({size[0]},iw)'"
            size[1] = "-2" if size[1] == '?' else f"'min({size[1]},ih)'"
        else:
            #Aspect ratio is likely changed. A more complex command is required
            #to crop the output to the new aspect ratio
            ar = float(size[0])/float(size[1])
            vfilters.append(f"crop=if(gt({ar}\\,a)\\,iw\\,ih*{ar}):if(gt({ar}\\,a)\\,iw/{ar}\\,ih)")
        size = ':'.join(size)
        vfilters.append(f"scale={size}")
    vfilters.append("setpts=PTS-STARTPTS")
    if len(vfilters) > 0:
        args += ["-vf", ",".join(vfilters)]
    if int(query.get('frame_load_cap', 0)) > 0:
        args += ["-frames:v", query['frame_load_cap']]
    #TODO:reconsider adding high frame cap/setting default frame cap on node

    args += ['-c:v', 'libvpx-vp9','-deadline', 'realtime', '-cpu-used', '8', '-f', 'webm', '-']

    try:
        with subprocess.Popen(args, stdout=subprocess.PIPE) as proc:
            try:
                resp = web.StreamResponse()
                resp.content_type = 'video/webm'
                resp.headers["Content-Disposition"] = f"filename=\"{filename}\""
                await resp.prepare(request)
                while True:
                    bytes_read = proc.stdout.read()
                    if bytes_read is None:
                        #TODO: check for timeout here
                        time.sleep(.1)
                        continue
                    if len(bytes_read) == 0:
                        break
                    await resp.write(bytes_read)
            except ConnectionResetError as e:
                #Kill ffmpeg before stdout closes
                proc.kill()
    except BrokenPipeError as e:
        pass
    return resp

@server.PromptServer.instance.routes.get("/getpath")
async def get_path(request):
    query = request.rel_url.query
    if "path" not in query:
        return web.Response(status=404)
    path = os.path.abspath(query["path"])

    if not os.path.exists(path) or not is_safe(path):
        return web.json_response([])

    #Use get so None is default instead of keyerror
    valid_extensions = query.get("extensions")
    valid_items = []
    for item in os.scandir(path):
        try:
            if item.is_dir():
                valid_items.append(item.name + "/")
                continue
            if valid_extensions is None or item.name.split(".")[-1] in valid_extensions:
                valid_items.append(item.name)
        except OSError:
            #Broken symlinks can throw a very unhelpful "Invalid argument"
            pass

    return web.json_response(valid_items)

def is_prompt_node_type_of(node_value, node_type: str) -> bool:
    return node_type in node_value.get("class_type", "") or node_type in node_value.get("_meta", {}).get("tile", "")

def is_workflow_node_type_of(node_value, node_type: str) -> bool:
    return node_type in node_value.get("type", "")

def test_prompt(json_data):
    import json    
    
    try:
        with open(".custom_nodes/komojini-comfyui-nodes/json_data", "w") as json_file:
            json_str = json.dumps(json_data, indent=4)
            json.dump(json_data, json_file)
    except Exception as e:
        print_info("Failed to save json data.")
        pass

    print_info("Got prompt")

    prompt = json_data['prompt']
    print(f"len(prompt): {len(prompt)}")


from .nodes.cache_data import CACHED_MAP

def search_setter_getter_connected_nodes(json_data):
    key_to_getter_node_ids = {}
    key_to_setter_node_id = {}
    
    prompt = json_data["prompt"]
    for node_id, v in prompt.items():
        if "class_type" in v and "inputs" in v:
            class_type: str = v["class_type"]
            inputs = v["inputs"]
            
            if is_prompt_node_type_of(v, "Get"):
                key = inputs["key"]

                if key and class_type.endswith("CachedGetter") and CACHED_MAP.get(key, None) is not None:
                    continue

                if key in key_to_getter_node_ids:
                    key_to_getter_node_ids[key].append(node_id)
                else:
                    key_to_getter_node_ids[key] = [node_id]
            elif is_prompt_node_type_of(v, "Set"):
                key = inputs["key"]
                key_to_setter_node_id[key] = node_id
    return key_to_getter_node_ids, key_to_setter_node_id
 

def search_setter_getter_from_workflow(json_data):
    key_to_getter_node_ids = {}
    key_to_setter_node_id = {}

    workflow = json_data["extra_data"]["extra_pnginfo"]["workflow"]
    last_node_id = workflow["last_node_id"]
    last_link_id = workflow["last_link_id"]
    nodes = workflow["nodes"]
    links = workflow["links"]
    prompt = json_data["prompt"]

    not_included_nodes_count = 0
    for node in nodes:
        # if node["id"] in prompt:
        #     continue
        if node["mode"] == 0 and node["id"] not in prompt:
            # print_info(f"node not in prompt. node: {node}")
            not_included_nodes_count += 1
            inputs = node.get("inputs", [])
            widget_values = node.get("widget_values")

            # {"name": "", "type": "", "link": 320}
            # prompt[node["id"]] = {
            #     "inputs": {
                    
            #     },
            #     "class_type": node["type"],
            #     "_meta": {
            #         "title": node[""],
            #     }
            # }
        if node.get("type", "").endswith("Setter"):
            key = node["widgets_values"][0]
        elif node.get("type", "").endswith("Getter"):
            key = node["widgets_values"][0]


        """
        {
            "id": 173,
            "type": "JsSetter",
            "pos": [
                6196,
                9558
            ],
            "size": {
                "0": 210,
                "1": 58
            },
            "flags": {},
            "order": 115,
            "mode": 0,
            "inputs": [
                {
                    "name": "IMAGE",
                    "type": "IMAGE",
                    "link": 235
                }
            ],
            "outputs": [
                {
                    "name": "IMAGE",
                    "type": "IMAGE",
                    "links": [
                        236
                    ],
                    "slot_index": 0
                }
            ],
            "title": "Set_STEERABLE_IMAGES",
            "properties": {
                "previousName": "STEERABLE_IMAGES"
            },
            "widgets_values": [
                "STEERABLE_IMAGES"
            ],
            "color": "#2a363b",
            "bgcolor": "#3f5159"
        },
        """
    print_info(f"{not_included_nodes_count} Nodes not included in prompt but is activated")
    return key_to_getter_node_ids, key_to_setter_node_id


def connect_to_from_nodes(json_data):
    prompt = json_data["prompt"]
    key_to_getter_node_ids, key_to_setter_node_id = search_setter_getter_connected_nodes(json_data)
    for getter_key, getter_node_ids in key_to_getter_node_ids.items():
        if getter_key in key_to_setter_node_id:
            setter_node_id = key_to_setter_node_id[getter_key]

            for getter_node_id in getter_node_ids:
                # if "*" in prompt[getter_node_id]["inputs"]:
                prompt[getter_node_id]["inputs"]["*"] = [setter_node_id, 0]
                # elif "value" in prompt[getter_node_id]["inputs"]:
                prompt[getter_node_id]["inputs"]["value"] = [setter_node_id, 0]
                # else:
                #     print(f"[WARN] Komojini-ComfyUI-CustonNodes: There is no 'Setter' node in the workflow for key: {getter_key}, inputs: {prompt[getter_node_id]['inputs']}")

                print(f"Connected getter {getter_node_id}: {json_data['prompt'][getter_node_id]}")
            if setter_node_id not in prompt:
                print(f"[WARN] setter node id for key({getter_key}) not in prompt, setter_node_id: {setter_node_id}")
        else:
            print(f"[WARN] Komojini-ComfyUI-CustonNodes: There is no 'Setter' node in the workflow for key: {getter_key}")
    

def workflow_update(json_data):
    prompt = json_data["prompt"]
    for k, v in prompt.items():
        if "class_type" in v and "inputs" in v:
            class_type = v["class_type"]
            inputs = v["inputs"]

            class_ = nodes.NODE_CLASS_MAPPINGS[class_type]
            if hasattr(class_, "OUTPUT_NODE") and class_.OUTPUT_NODE == True:
                pass 
            if class_type == "Getter":
                id = inputs["key"]
                

def on_prompt_handler(json_data):
    try:
        test_prompt(json_data)
        search_setter_getter_from_workflow(json_data)
        connect_to_from_nodes(json_data)

    except Exception as e:
        print_info(f"[WARN] Komojini-ComfyUI-CustomNodes: Error on prompt\n{e}")
    return json_data

server.PromptServer.instance.add_on_prompt_handler(on_prompt_handler)