

import { app } from '../../scripts/app.js';
import { api } from '../../scripts/api.js';
import { applyTextReplacements } from "../../scripts/utils.js";
import { findWidgetByName, doesInputWithNameExist, findWidgetsByType } from "./utils.js";


function chainCallback(object, property, callback) {
    if (object == undefined) {
        //This should not happen.
        console.error("Tried to add callback to non-existant object")
        return;
    }
    if (property in object) {
        const callback_orig = object[property]
        object[property] = function () {
            const r = callback_orig.apply(this, arguments);
            callback.apply(this, arguments);
            return r
        };
    } else {
        object[property] = callback;
    }
}

function injectHidden(widget) {
    widget.computeSize = (target_width) => {
        if (widget.hidden) {
            return [0, -4];
        }
        return [target_width, 20];
    };
    widget._type = widget.type
    Object.defineProperty(widget, "type", {
        set : function(value) {
            widget._type = value;
        },
        get : function() {
            if (widget.hidden) {
                return "hidden";
            }
            return widget._type;
        }
    });
}

const convDict = {
    UltimateVideoLoader: ["source", "youtube_url", "video", "upload", "start_sec", "end_sec", "force_size", "max_fps", "frame_load_cap"],
};

const renameDict  = {VHS_VideoCombine : {save_output : "save_image"}}

function useKVState(nodeType) {
    chainCallback(nodeType.prototype, "onNodeCreated", function () {
        chainCallback(this, "onConfigure", function(info) {
            if (!this.widgets) {
                //Node has no widgets, there is nothing to restore
                return
            }
            if (typeof(info.widgets_values) != "object") {
                //widgets_values is in some unknown inactionable format
                return
            }
            let widgetDict = info.widgets_values
            if (info.widgets_values.length) {
                //widgets_values is in the old list format
                if (this.type in convDict) {
                    //widget does not have a conversion format provided
                    let convList = convDict[this.type];
                    if(info.widgets_values.length >= convList.length) {
                        //has all required fields
                        widgetDict = {}
                        for (let i = 0; i < convList.length; i++) {
                            if(!convList[i]) {
                                //Element should not be processed (upload button on load image sequence)
                                continue
                            }
                            widgetDict[convList[i]] = info.widgets_values[i];
                        }
                    } else {
                        //widgets_values is missing elements marked as required
                        //let it fall through to failure state
                    }
                }
            }
            if (widgetDict.length == undefined) {
                for (let w of this.widgets) {
                    if (w.name in widgetDict) {
                        w.value = widgetDict[w.name];
                    } else {
                        //Check for a legacy name that needs migrating
                        if (this.type in renameDict && w.name in renameDict[this.type]) {
                            if (renameDict[this.type][w.name] in widgetDict) {
                                w.value = widgetDict[renameDict[this.type][w.name]]
                                continue
                            }
                        }
                        //attempt to restore default value
                        let inputs = LiteGraph.getNodeType(this.type).nodeData.input;
                        let initialValue = null;
                        if (inputs?.required?.hasOwnProperty(w.name)) {
                            if (inputs.required[w.name][1]?.hasOwnProperty("default")) {
                                initialValue = inputs.required[w.name][1].default;
                            } else if (inputs.required[w.name][0].length) {
                                initialValue = inputs.required[w.name][0][0];
                            }
                        } else if (inputs?.optional?.hasOwnProperty(w.name)) {
                            if (inputs.optional[w.name][1]?.hasOwnProperty("default")) {
                                initialValue = inputs.optional[w.name][1].default;
                            } else if (inputs.optional[w.name][0].length) {
                                initialValue = inputs.optional[w.name][0][0];
                            }
                        }
                        if (initialValue) {
                            w.value = initialValue;
                        }
                    }
                }
            } else {
                //Saved data was not a map made by this method
                //and a conversion dict for it does not exist
                //It's likely an array and that has been blindly applied
                if (info?.widgets_values?.length != this.widgets.length) {
                    //Widget could not have restored properly
                    //Note if multiple node loads fail, only the latest error dialog displays
                    app.ui.dialog.show("Failed to restore node: " + this.title + "\nPlease remove and re-add it.")
                    this.bgcolor = "#C00"
                }
            }
        });
        chainCallback(this, "onSerialize", function(info) {
            info.widgets_values = {};
            if (!this.widgets) {
                //object has no widgets, there is nothing to store
                return;
            }
            for (let w of this.widgets) {
                info.widgets_values[w.name] = w.value;
            }
        });
    })
}

function fitHeight(node) {
    node.setSize([node.size[0], node.computeSize([node.size[0], node.size[1]])[1]])
    node?.graph?.setDirtyCanvas(true);
}

async function uploadFile(file) {
    //TODO: Add uploaded file to cache with Cache.put()?
    try {
        // Wrap file in formdata so it includes filename
        const body = new FormData();
        const i = file.webkitRelativePath.lastIndexOf('/');
        const subfolder = file.webkitRelativePath.slice(0,i+1)
        const new_file = new File([file], file.name, {
            type: file.type,
            lastModified: file.lastModified,
        });
        body.append("image", new_file);
        if (i > 0) {
            body.append("subfolder", subfolder);
        }
        const resp = await api.fetchApi("/upload/image", {
            method: "POST",
            body,
        });

        if (resp.status === 200) {
            return resp.status
        } else {
            alert(resp.status + " - " + resp.statusText);
        }
    } catch (error) {
        alert(error);
    }
}

function addCustomSize(nodeType, nodeData, widgetName) {
    //Add the extra size widgets now
    //This takes some finagling as widget order is defined by key order
    const newWidgets = {};
    for (let key in nodeData.input.required) {
        newWidgets[key] = nodeData.input.required[key]
        if (key == widgetName) {
            newWidgets[key][0] = newWidgets[key][0].concat(["Custom Width", "Custom Height", "Custom"])
            newWidgets["custom_width"] = ["INT", {"default": 512, "min": 8, "step": 8}]
            newWidgets["custom_height"] = ["INT", {"default": 512, "min": 8, "step": 8}]
        }
    }
    nodeData.input.required = newWidgets;

    //Add a callback which sets up the actual logic once the node is created
    chainCallback(nodeType.prototype, "onNodeCreated", function() {
        const node = this;
        const sizeOptionWidget = node.widgets.find((w) => w.name === widgetName);
        const widthWidget = node.widgets.find((w) => w.name === "custom_width");
        const heightWidget = node.widgets.find((w) => w.name === "custom_height");
        injectHidden(widthWidget);
        widthWidget.options.serialize = false;
        injectHidden(heightWidget);
        heightWidget.options.serialize = false;
        sizeOptionWidget._value = sizeOptionWidget.value;
        Object.defineProperty(sizeOptionWidget, "value", {
            set : function(value) {
                //TODO: Only modify hidden/reset size when a change occurs
                if (value == "Custom Width") {
                    widthWidget.hidden = false;
                    heightWidget.hidden = true;
                } else if (value == "Custom Height") {
                    widthWidget.hidden = true;
                    heightWidget.hidden = false;
                } else if (value == "Custom") {
                    widthWidget.hidden = false;
                    heightWidget.hidden = false;
                } else{
                    widthWidget.hidden = true;
                    heightWidget.hidden = true;
                }
                node.setSize([node.size[0], node.computeSize([node.size[0], node.size[1]])[1]])
                this._value = value;
            },
            get : function() {
                return this._value;
            }
        });
        //prevent clobbering of new options on refresh
        sizeOptionWidget.options._values = sizeOptionWidget.options.values;
        Object.defineProperty(sizeOptionWidget.options, "values", {
            set : function(values) {
                this._values = values;
                this._values.push("Custom Width", "Custom Height", "Custom");
            },
            get : function() {
                return this._values;
            }
        });
        //Ensure proper visibility/size state for initial value
        sizeOptionWidget.value = sizeOptionWidget._value;

        sizeOptionWidget.serializeValue = function() {
            if (this.value == "Custom Width") {
                return widthWidget.value + "x?";
            } else if (this.value == "Custom Height") {
                return "?x" + heightWidget.value;
            } else if (this.value == "Custom") {
                return widthWidget.value + "x" + heightWidget.value;
            } else {
                return this.value;
            }
        };
    });
}

function addUploadWidget(nodeType, nodeData, widgetName, type="video") {
    console.info("addUploadWidget start...");

    chainCallback(nodeType.prototype, "onNodeCreated", function() {
        console.debug("addUploadWidget onNodeCreated callback start");
        const sourceWidget = findWidgetByName(this, "source");

        const pathWidget = findWidgetByName(this, widgetName);
        const fileInput = document.createElement("input");


        chainCallback(this, "onRemoved", () => {
            fileInput?.remove();
        });

        Object.assign(fileInput, {
            type: "file",
            accept: "video/webm,video/mp4,video/mkv,image/gif",
            style: "display: none",
            onchange: async () => {
                if (fileInput.files.length) {
                    if (await uploadFile(fileInput.files[0]) != 200) {
                        //upload failed and file can not be added to options
                        return;
                    }
                    const filename = fileInput.files[0].name;
                    pathWidget.options.values.push(filename);
                    pathWidget.value = filename;

                    sourceWidget.value = "fileupload";

                    const name = "upload";

                    const pathValue = findWidgetByName(this, name)?.value;
                    if (!pathValue) {
                        console.debug("path not available", value);
                        return;
                    }
                    console.debug("pathValue", pathValue)

                    let parts = ["input", pathValue];
                    let extension_index = parts[1].lastIndexOf(".");
                    let extension = parts[1].slice(extension_index+1);
                    let format = "video";

                    if (["gif", "webp", "avif"].includes(extension)) {
                        format = "image";
                    }
                    format += "/" + extension;
                    
                    var params = {filename : parts[1], type : parts[0], format: format};
                    this.updateParameters(params, true);

                }
            },
        });

        document.body.append(fileInput);
        let uploadWidget = this.addWidget("button", "choose " + type + " to upload", "image", () => {
            //clear the active click event
            // {
            //     "type": "button",
            //     "name": "choose video to upload",
            //     "value": "image",
            //     "options": {
            //       "serialize": false
            //     },
            //     "last_y": 670
            //   }
            app.canvas.node_widget = null

            fileInput.click();
        });
        uploadWidget.options.serialize = false;
        
        chainCallback(sourceWidget, "callback", (value) => {
            console.debug("source callback in addUploadWidget");
        });
    });
}

function addVideoPreview(nodeType) {
    chainCallback(nodeType.prototype, "onNodeCreated", function() {
        let previewNode = this;
        //preview is a made up widget type to enable user defined functions
        //videopreview is widget name
        //The previous implementation used type to distinguish between a video and gif,
        //but the type is not serialized and would not survive a reload
        var previewWidget = { name : "videopreview", type : "preview",
            draw : function(ctx, node, widgetWidth, widgetY, height) {
                //update widget position, hide if off-screen
                const transform = ctx.getTransform();
                const scale = app.canvas.ds.scale;//gets the litegraph zoom
                //calculate coordinates with account for browser zoom
                const x = transform.e*scale/transform.a;
                const y = transform.f*scale/transform.a;
                Object.assign(this.parentEl.style, {
                    left: (x+15*scale) + "px",
                    top: (y + widgetY*scale) + "px",
                    width: ((widgetWidth-30)*scale) + "px",
                    zIndex: 2 + (node.is_selected ? 1 : 0),
                    position: "absolute",
                });
                this._boundingCount = 0;
            },
            computeSize : function(width) {
                if (this.aspectRatio && !this.parentEl.hidden) {
                    let height = (previewNode.size[0]-30)/ this.aspectRatio;
                    if (!(height > 0)) {
                        height = 0;
                    }
                    return [width, height];
                }
                return [width, -4];//no loaded src, widget should not display
            },
            value : {hidden: false, paused: false, params: {}}
        };
        //onRemoved isn't a litegraph supported function on widgets
        //Given that onremoved widget and node callbacks are sparse, this
        //saves the required iteration.
        chainCallback(this, "onRemoved", () => {
            previewWidget?.parentEl?.remove();
        });
        previewWidget.options = {serialize : false};
        this.addCustomWidget(previewWidget);
        previewWidget.parentEl = document.createElement("div");
        previewWidget.parentEl.className = "komojini_preview";
        //previewWidget.parentEl.style['pointer-events'] = "none"

     
        previewWidget.videoEl = document.createElement("video");
        previewWidget.videoEl.controls = false;
        previewWidget.videoEl.loop = true;
        previewWidget.videoEl.muted = true;

        previewWidget.videoEl.style['width'] = "100%"
        previewWidget.videoEl.addEventListener("loadedmetadata", () => {
            previewWidget.aspectRatio = previewWidget.videoEl.videoWidth / previewWidget.videoEl.videoHeight;
            fitHeight(this);
        });
        previewWidget.videoEl.addEventListener("error", () => {
            //TODO: consider a way to properly notify the user why a preview isn't shown.
            previewWidget.parentEl.hidden = true;
            fitHeight(this);
        });

        previewWidget.imgEl = document.createElement("img");
        previewWidget.imgEl.style['width'] = "100%"
        previewWidget.imgEl.hidden = true;
        previewWidget.imgEl.onload = () => {
            previewWidget.aspectRatio = previewWidget.imgEl.naturalWidth / previewWidget.imgEl.naturalHeight;
            fitHeight(this);
        };

        previewWidget.iframe = document.createElement("iframe");
        previewWidget.iframe.style['width'] = "100%";
        previewWidget.iframe.style['height'] = "100%";

        previewWidget.iframe.overflow = true;
        
        previewWidget.iframe.hidden = true;
        previewWidget.iframe.onload = () => {
            previewWidget.aspectRatio = 16 / 9;
            fitHeight(this);
        }
        previewWidget.iframe.addEventListener("error", () => {
            //TODO: consider a way to properly notify the user why a preview isn't shown.
            previewWidget.parentEl.hidden = true;
            fitHeight(this);
        });

        var timeout;
        this.updateParameters = (params, force_update) => {
            if (!previewWidget.value.params) {
                if(typeof(previewWidget.value != 'object')) {
                    previewWidget.value =  {hidden: false, paused: false}
                }
                previewWidget.value.params = {}
            }
            Object.assign(previewWidget.value.params, params)
            if (!force_update &&
                !app.ui.settings.getSettingValue("komojini.AdvancedPreviews", false)) {
                return;
            }
            if (timeout) {
                clearTimeout(timeout);
            }
            if (force_update) {
                previewWidget.updateSource();
            } else {
                timeout = setTimeout(() => previewWidget.updateSource(),400);
            }
        };
        previewWidget.updateSource = function () {
            if (this.value.params == undefined) {
                return;
            }
            let params =  {}
            Object.assign(params, this.value.params);//shallow copy
            this.parentEl.hidden = this.value.hidden;
            if (params.format?.split('/')[0] == 'video' ||
                app.ui.settings.getSettingValue("komojini.AdvancedPreviews", false) &&
                (params.format?.split('/')[1] == 'gif') || params.format == 'folder') {
                this.videoEl.autoplay = !this.value.paused && !this.value.hidden;
                let target_width = 256
                if (this.parentEl.style?.width) {
                    //overscale to allow scrolling. Endpoint won't return higher than native
                    target_width = this.parentEl.style.width.slice(0,-2)*2;
                }
                if (!params.force_size || params.force_size.includes("?") || params.force_size == "Disabled") {
                    params.force_size = target_width+"x?"
                } else {
                    let size = params.force_size.split("x")
                    let ar = parseInt(size[0])/parseInt(size[1])
                    params.force_size = target_width+"x"+(target_width/ar)
                }
                if (app.ui.settings.getSettingValue("komojini.AdvancedPreviews", false)) {
                    this.videoEl.src = api.apiURL('/viewvideo?' + new URLSearchParams(params));
                } else {
                    previewWidget.videoEl.src = api.apiURL('/view?' + new URLSearchParams(params));
                }
                this.videoEl.hidden = false;
                this.imgEl.hidden = true;
                this.iframe.hidden = true;
            } else if (params.format?.split('/')[0] == 'image'){
                //Is animated image
                this.imgEl.src = api.apiURL('/view?' + new URLSearchParams(params));
                this.videoEl.hidden = true;
                this.imgEl.hidden = false;
                this.iframe.hidden = true;
            } else if (params.format === "youtube") {
                this.videoEl.hidden = true;
                this.imgEl.hidden = true;
                if (!params.filename.includes("embed")) {
                    const youtube_id = params.filename.split('/')[params.filename.split('/').length - 1];
                    var youtube_url = "https://www.youtube.com/embed/" + youtube_id;
                } else {
                    var youtube_url = params.filename;
                }
                var startSec = Math.floor(findWidgetByName(this, "start_sec")?.value ?? 0);
                if (startSec > 0) {
                    youtube_url = youtube_url + "?t=" + startSec.toString();
                    console.debug("start_sec not 0, youtube_url:", youtube_url);
                }
                this.iframe.src = youtube_url

                this.iframe.hidden = false;
            }
        }
        //Hide video element if offscreen
        //The multiline input implementation moves offscreen every frame
        //and doesn't apply until a node with an actual inputEl is loaded
        this._boundingCount = 0;
        this.onBounding = function() {
            if (this._boundingCount++>5) {
                previewWidget.parentEl.style.left = "-8000px";
            }
        }
        previewWidget.parentEl.appendChild(previewWidget.videoEl);
        previewWidget.parentEl.appendChild(previewWidget.imgEl);
        previewWidget.parentEl.appendChild(previewWidget.iframe);
        document.body.appendChild(previewWidget.parentEl);
    });
}

function addPreviewOptions(nodeType) {
    chainCallback(nodeType.prototype, "getExtraMenuOptions", function(_, options) {
        // The intended way of appending options is returning a list of extra options,
        // but this isn't used in widgetInputs.js and would require
        // less generalization of chainCallback
        let optNew = []
        const previewWidget = this.widgets.find((w) => w.name === "videopreview");

        let url = null
        if (previewWidget.videoEl?.hidden == false && previewWidget.videoEl.src) {
            //Use full quality video
            url = api.apiURL('/view?' + new URLSearchParams(previewWidget.value.params));
        } else if (previewWidget.imgEl?.hidden == false && previewWidget.imgEl.src) {
            url = previewWidget.imgEl.src;
            url = new URL(url);
        }
        if (url) {
            optNew.push(
                {
                    content: "Open preview",
                    callback: () => {
                        window.open(url, "_blank");
                    },
                },
                {
                    content: "Save preview",
                    callback: () => {
                        const a = document.createElement("a");
                        a.href = url;
                        a.setAttribute("download", new URLSearchParams(previewWidget.value.params).get("filename"));
                        document.body.append(a);
                        a.click();
                        requestAnimationFrame(() => a.remove());
                    },
                }
            );
        }
        const PauseDesc = (previewWidget.value.paused ? "Resume" : "Pause") + " preview";
        if(previewWidget.videoEl.hidden == false) {
            optNew.push({content: PauseDesc, callback: () => {
                //animated images can't be paused and are more likely to cause performance issues.
                //changing src to a single keyframe is possible,
                //For now, the option is disabled if an animated image is being displayed
                if(previewWidget.value.paused) {
                    previewWidget.videoEl?.play();
                } else {
                    previewWidget.videoEl?.pause();
                }
                previewWidget.value.paused = !previewWidget.value.paused;
            }});
        }
        //TODO: Consider hiding elements if no video preview is available yet.
        //It would reduce confusion at the cost of functionality
        //(if a video preview lags the computer, the user should be able to hide in advance)
        const visDesc = (previewWidget.value.hidden ? "Show" : "Hide") + " preview";
        optNew.push({content: visDesc, callback: () => {
            if (!previewWidget.videoEl.hidden && !previewWidget.value.hidden) {
                previewWidget.videoEl.pause();
            } else if (previewWidget.value.hidden && !previewWidget.videoEl.hidden && !previewWidget.value.paused) {
                previewWidget.videoEl.play();
            }
            previewWidget.value.hidden = !previewWidget.value.hidden;
            previewWidget.parentEl.hidden = previewWidget.value.hidden;
            fitHeight(this);

        }});
        optNew.push({content: "Sync preview", callback: () => {
            //TODO: address case where videos have varying length
            //Consider a system of sync groups which are opt-in?
            for (let p of document.getElementsByClassName("komojini_preview")) {
                for (let child of p.children) {
                    if (child.tagName == "VIDEO") {
                        child.currentTime=0;
                    } else if (child.tagName == "IMG") {
                        child.src = child.src;
                    }
                }
            }
        }});
        if(options.length > 0 && options[0] != null && optNew.length > 0) {
            optNew.push(null);
        }
        options.unshift(...optNew);
    });
}


function addLoadVideoCommon(nodeType, nodeData) {
    addCustomSize(nodeType, nodeData, "force_size");
    addVideoPreview(nodeType);
    addPreviewOptions(nodeType);
    chainCallback(nodeType.prototype, "onNodeCreated", function() {
        const sourceWidget = findWidgetByName(this, "source");
        const pathWidget = this.widgets.find((w) => w.name === "upload");
        const startWidget = this.widgets.find((w) => w.name === 'start_sec');
        const endWidget = this.widgets.find((w) => w.name === 'end_sec');
        const sizeWidget = this.widgets.find((w) => w.name === 'force_size');
        const maxFpsWidget = this.widgets.find((w) => w.name === 'max_fps');
        const frameCapWidget = findWidgetByName(this, "frame_load_cap");
        //widget.callback adds unused arguements which need culling
        let update = function (value, _, node) {
            let param = {}
            param[this.name] = value
            node.updateParameters(param);
        }
        chainCallback(sourceWidget, "callback", update);

        chainCallback(frameCapWidget, "callback", update);
        chainCallback(endWidget, "callback", update);
        chainCallback(startWidget, "callback", update);
        chainCallback(maxFpsWidget, "callback", update);
        let updateSize = function(value, _, node) {
            node.updateParameters({"force_size": sizeWidget.serializeValue()})
        }
        chainCallback(sizeWidget, "callback", updateSize);
        chainCallback(this.widgets.find((w) => w.name === "custom_width"), "callback", updateSize);
        chainCallback(this.widgets.find((w) => w.name === "custom_height"), "callback", updateSize);

        //do first load
        requestAnimationFrame(() => {
            for (let w of [frameCapWidget, endWidget, startWidget, pathWidget, maxFpsWidget]) {
                w.callback(w.value, null, this);
            }
        });
    });
}

function path_stem(path) {
    let i = path.lastIndexOf("/");
    if (i >= 0) {
        return [path.slice(0,i+1),path.slice(i+1)];
    }
    return ["",path];
}

function searchBox(event, [x,y], node) {
    //Ensure only one dialogue shows at a time
    if (this.prompt)
        return;
    this.prompt = true;

    let pathWidget = this;
    let dialog = document.createElement("div");
    dialog.className = "litegraph litesearchbox graphdialog rounded"
    dialog.innerHTML = '<span class="name">Path</span> <input autofocus="" type="text" class="value"><button class="rounded">OK</button><div class="helper"></div>'
    dialog.close = () => {
        dialog.remove();
    }
    document.body.append(dialog);
    if (app.canvas.ds.scale > 1) {
        dialog.style.transform = "scale(" + app.canvas.ds.scale + ")";
    }
    var name_element = dialog.querySelector(".name");
    var input = dialog.querySelector(".value");
    var options_element = dialog.querySelector(".helper");
    input.value = pathWidget.value;

    var timeout = null;
    let last_path = null;

    input.addEventListener("keydown", (e) => {
        dialog.is_modified = true;
        if (e.keyCode == 27) {
            //ESC
            dialog.close();
        } else if (e.keyCode == 13 && e.target.localName != "textarea") {
            pathWidget.value = input.value;
            if (pathWidget.callback) {
                pathWidget.callback(pathWidget.value);
            }
            dialog.close();
        } else {
            if (e.keyCode == 9) {
                //TAB
                input.value = last_path + options_element.firstChild.innerText;
                e.preventDefault();
                e.stopPropagation();
            } else if (e.ctrlKey && e.keyCode == 87) {
                //Ctrl+w
                //most browsers won't support, but it's good QOL for those that do
                input.value = path_stem(input.value.slice(0,-1))[0]
                e.preventDefault();
                e.stopPropagation();
            }
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(updateOptions, 10);
            return;
        }
        this.prompt=false;
        e.preventDefault();
        e.stopPropagation();
    });

    var button = dialog.querySelector("button");
    button.addEventListener("click", (e) => {
        pathWidget.value = input.value;
        if (pathWidget.callback) {
            pathWidget.callback(pathWidget.value);
        }
        //unsure why dirty is set here, but not on enter-key above
        node.graph.setDirtyCanvas(true);
        dialog.close();
        this.prompt = false;
    });
    var rect = app.canvas.canvas.getBoundingClientRect();
    var offsetx = -20;
    var offsety = -20;
    if (rect) {
        offsetx -= rect.left;
        offsety -= rect.top;
    }
    if (event) {
        dialog.style.left = event.clientX + offsetx + "px";
        dialog.style.top = event.clientY + offsety + "px";
    } else {
        dialog.style.left = canvas.width * 0.5 + offsetx + "px";
        dialog.style.top = canvas.height * 0.5 + offsety + "px";
    }
    //Search code
    let options = []
    function addResult(name, isDir) {
        let el = document.createElement("div");
        el.innerText = name;
        el.className = "litegraph lite-search-item";
        if (isDir) {
            el.className += " is-dir";
            el.addEventListener("click", (e) => {
                input.value = last_path+name
                if (timeout) {
                    clearTimeout(timeout);
                }
            timeout = setTimeout(updateOptions, 10);
            });
        } else {
            el.addEventListener("click", (e) => {
                pathWidget.value = last_path+name;
                if (pathWidget.callback) {
                    pathWidget.callback(pathWidget.value);
                }
                dialog.close();
                pathWidget.prompt = false;
            });
        }
        options_element.appendChild(el);
    }
    async function updateOptions() {
        timeout = null;
        let [path, remainder] = path_stem(input.value);
        if (last_path != path) {
            //fetch options.  Must block execution here, so update should be async?
            let params = {path : path, extensions : pathWidget.options.extensions}
            let optionsURL = api.apiURL('getpath?' + new URLSearchParams(params));
            try {
                let resp = await fetch(optionsURL);
                options = await resp.json();
            } catch(e) {
                options = []
            }
            last_path = path;
        }
        options_element.innerHTML = '';
        //filter options based on remainder
        for (let option of options) {
            if (option.startsWith(remainder)) {
                let isDir = option.endsWith('/')
                addResult(option, isDir);
            }
        }
    }

    setTimeout(async function() {
        input.focus();
        await updateOptions();
    }, 10);

    return dialog;
}


app.ui.settings.addSetting({
    id: "komojini.AdvancedPreviews",
    name: "🎥Komojini Advanced Previews",
    type: "boolean",
    defaultValue: false,
});


app.registerExtension({
    name: "komojini.core",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        console.info("beforeRegisterNodeDef starting... nodeData?.name:", nodeData?.name);

        if(nodeData?.name?.endsWith("Loader")) {
            useKVState(nodeType);
            chainCallback(nodeType.prototype, "onNodeCreated", function () {
                console.debug("onNodeCreated: ", nodeData?.name, findWidgetByName(this, "source")?.value);
                let new_widgets = []
                if (this.widgets) {
                    for (let w of this.widgets) {
                        let input = this.constructor.nodeData.input
                        let config = input?.required[w.name] ?? input.optional[w.name]
                        if (!config) {
                            continue
                        }
                        if (w?.type == "text" && config[1].path_extensions) {
                            new_widgets.push(app.widgets.VHSPATH({}, w.name, ["VHSPATH", config[1]]));
                        } else {
                            new_widgets.push(w)
                        }
                    }
                    this.widgets = new_widgets;
                }
            });
        }

        if (nodeData?.name == "UltimateVideoLoader") {
            console.debug("start adding upload widget", nodeData);
            addUploadWidget(nodeType, nodeData, "upload", "video");

            chainCallback(nodeType.prototype, "onNodeCreated", function() {

                const pathWidget = findWidgetByName(this, "upload");
                const sourceWidget = findWidgetByName(this, "source");
                const filePathWidget = findWidgetByName(this, "video");
                const youtubeUrlWidget = findWidgetByName(this, "youtube_url");

                // const pathWidget = this.widgets.find((w) => w.name === "video");
                chainCallback(pathWidget, "callback", (value) => {
                    if (!value) {
                        return;
                    }
                    let parts = ["input", value];
                    let extension_index = parts[1].lastIndexOf(".");
                    let extension = parts[1].slice(extension_index+1);
                    let format = "video";
                    if (["gif", "webp", "avif"].includes(extension)) {
                        format = "image";
                    }
                    format += "/" + extension;
                    let params = {filename : parts[1], type : parts[0], format: format};
                    this.updateParameters(params, true);
                });

                chainCallback(filePathWidget, "callback", (value) => {
                    let extension_index = value.lastIndexOf(".");
                    let extension = value.slice(extension_index+1);
                    let format = "video"
                    if (["gif", "webp", "avif"].includes(extension)) {
                        format = "image"
                    }
                    format += "/" + extension;
                    let params = {filename : value, type: "path", format: format};
                    this.updateParameters(params, true);
                });

                chainCallback(youtubeUrlWidget, "callback", (value) => {
                    //this.updateParameters();
                    let params = {filename: value, type: "youtube", format: "youtube"};
                    this.updateParameters(params, true);
                });
                
                chainCallback(sourceWidget, "callback", (value) => {
                    const valueToPathMap = {
                        "YouTube": "youtube_url",
                        "filepath": "video",
                        "fileupload": "upload",
                    };
                    const name = valueToPathMap[value];

                    const pathValue = findWidgetByName(this, name)?.value;
                    if (!pathValue) {
                        console.debug("path not available", value);
                        return;
                    }
                    console.debug("source callback", value, "pathValue", pathValue)

                    let parts = ["input", pathValue];
                    let extension_index = parts[1].lastIndexOf(".");
                    let extension = parts[1].slice(extension_index+1);
                    let format = "video";

                    if (["gif", "webp", "avif"].includes(extension)) {
                        format = "image";
                    }
                    format += "/" + extension;
                    if (value === "fileupload") {
                        var params = {filename : parts[1], type : parts[0], format: format};
                    } else if (value === "filepath") {
                        var params = {filename : pathValue, type: "path", format: format};
                    } else {
                        var params = {filename : pathValue, type: "youtube", format: "youtube"};
                    }
                    console.debug("params updated", params);
                    this.updateParameters(params, true);
                });
            });
            addLoadVideoCommon(nodeType, nodeData);
        }
    },
    async getCustomWidgets() {
        return {
            VHSPATH(node, inputName, inputData) {
                let w = {
                    name : inputName,
                    type : "komojini.PATH",
                    value : "",
                    draw : function(ctx, node, widget_width, y, H) {
                        //Adapted from litegraph.core.js:drawNodeWidgets
                        var show_text = app.canvas.ds.scale > 0.5;
                        var margin = 15;
                        var text_color = LiteGraph.WIDGET_TEXT_COLOR;
                        var secondary_text_color = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR;
                        ctx.textAlign = "left";
                        ctx.strokeStyle = LiteGraph.WIDGET_OUTLINE_COLOR;
                        ctx.fillStyle = LiteGraph.WIDGET_BGCOLOR;
                        ctx.beginPath();
                        if (show_text)
                            ctx.roundRect(margin, y, widget_width - margin * 2, H, [H * 0.5]);
                        else
                            ctx.rect( margin, y, widget_width - margin * 2, H );
                        ctx.fill();
                        if (show_text) {
                            if(!this.disabled)
                                ctx.stroke();
                            ctx.save();
                            ctx.beginPath();
                            ctx.rect(margin, y, widget_width - margin * 2, H);
                            ctx.clip();

                            //ctx.stroke();
                            ctx.fillStyle = secondary_text_color;
                            const label = this.label || this.name;
                            if (label != null) {
                                ctx.fillText(label, margin * 2, y + H * 0.7);
                            }
                            ctx.fillStyle = text_color;
                            ctx.textAlign = "right";
                            let disp_text = this.format_path(String(this.value))
                            ctx.fillText(disp_text, widget_width - margin * 2, y + H * 0.7); //30 chars max
                            ctx.restore();
                        }
                    },
                    mouse : searchBox,
                    options : {},
                    format_path : function(path) {
                        //Formats the full path to be under 30 characters
                        if (path.length <= 30) {
                            return path;
                        }
                        let filename = path_stem(path)[1]
                        if (filename.length > 28) {
                            //may all fit, but can't squeeze more info
                            return filename.substr(0,30);
                        }
                        //TODO: find solution for windows, path[1] == ':'?
                        let isAbs = path[0] == '/';
                        let partial = path.substr(path.length - (isAbs ? 28:29))
                        let cutoff = partial.indexOf('/');
                        if (cutoff < 0) {
                            //Can occur, but there isn't a nicer way to format
                            return path.substr(path.length-30);
                        }
                        return (isAbs ? '/…':'…') + partial.substr(cutoff);

                    }
                };
                if (inputData.length > 1) {
                    if (inputData[1].vhs_path_extensions) {
                        w.options.extensions = inputData[1].vhs_path_extensions;
                    }
                    if (inputData[1].default) {
                        w.value = inputData[1].default;
                    }
                }

                if (!node.widgets) {
                    node.widgets = [];
                }
                node.widgets.push(w);
                return w;
            }
        }
    }
});
