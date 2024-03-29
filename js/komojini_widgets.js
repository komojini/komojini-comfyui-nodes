

import { app } from '../../scripts/app.js'
import { api } from '../../scripts/api.js'

import { log } from './comfy_shared.js'
import * as shared from './comfy_shared.js'
import { DEBUG_STRING, findWidgetByName, isSetter, isGetter, setColorAndBgColor, enableOnlyRelatedNodes } from './utils.js'
import { executeAndWaitForTargetNode } from './komojini.chain.js'


const END_EMOJI = '🔥';

const newTypes = [ 'BUTTON']

const _drawImage = (node, imageNode, canvasEl, ctx) =>  {
               
    var x=0, y=0, w=imageNode.width, h=imageNode.height;

    const size = node.properties.size;

    canvasEl.width = size[0];
    canvasEl.height = size[1];

    canvasEl.style = `width: ${size[0]}px; height: ${size[1]}px;`
    canvasEl.style.border = "1px dotted gray"
    
    if (!imageNode.width) {
        return;
    }

    else if (imageNode.width / imageNode.height > canvasEl.width/canvasEl.height) {
        y = 0;
        h = imageNode.height
        w = imageNode.height * canvasEl.width / canvasEl.height
        x = (imageNode.width - w) / 2
    } else {
        x = 0;
        w = imageNode.width
        h = imageNode.width * canvasEl.height / canvasEl.width
        y = (imageNode.height - h) / 2
    }
    ctx.drawImage(imageNode, x, y, w, h, 0, 0, canvasEl.width, canvasEl.height)
}

function drawAllLines(node, draglines, imageNode, canvas) {
    var ctx

    ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    _drawImage(node, imageNode, canvas, ctx);

    for (const line of draglines) {
        var prevX, prevY = null;
        for (const pos of line) {
            var newX = pos[0];
            var newY = pos[1];
            
            if (prevX && prevY) {
                drawArrow(prevX, prevY, newX, newY, ctx);
            } else {
                ctx.beginPath();
                ctx.arc(newX, newY, 4, 0, 2 * Math.PI);
                ctx.fillStyle = 'red';
                ctx.fill(); 
            }
            prevX = newX;
            prevY = newY;
        }
    }
}

function drawArrow(x1, y1, x2, y2, ctx) {
    // Calculate the arrow direction
    const direction = Math.atan2(y2 - y1, x2 - x1);

    if (!(x1 && y1 && x2 && y2)) {
        return;
    } else if ((x1 == x2 && y1 == y2)) {
        return;
    }

    // Draw a line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Draw arrowhead
    const arrowheadSize = 14;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - arrowheadSize * Math.cos(direction - Math.PI / 6),
      y2 - arrowheadSize * Math.sin(direction - Math.PI / 6)
    );
    ctx.lineTo(
      x2 - arrowheadSize * Math.cos(direction + Math.PI / 6),
      y2 - arrowheadSize * Math.sin(direction + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
    
}

function getLast(array) {
    return array[array.length -1]
}


const komojini_widgets = {
    name: 'komojini.widgets',

    init: async () => {
        log('Registering komojini.widgets')
        try {
            const res = await api.fetchApi('/komojini/debug');
            const msg = res.json();
            if (!window.komojini) {
                window.komojini = {};
            }
            window.komojini.DEBUG = msg.DEBUG;
        } catch (e) {
            console.error('Error', error);
        }
    },

    setup: () => {
        app.ui.settings.addSetting({
            id: "komojini.NodeAutoColor",
            name: "🔥 Auto color nodes by name & output type",
            type: "boolean",
            defaultValue: false,
        });
    },
    /**
     * @param {import("./types/comfy").NodeType} nodeType
     * @param {import("./types/comfy").NodeDef} nodeData
     * @param {import("./types/comfy").App} app
     */
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        const node = this;

        const addFlowRunButton = function(node) {
            const batchSizeWidget = findWidgetByName(node, "batch_size")
            if (batchSizeWidget) {            
                shared.hideWidgetForGood(node, batchSizeWidget)
            }

            const run_button = node.addWidget(
                'button',
                `Queue`,
                'queue',
                () => {
                    app.canvas.setDirty(true);
                    
                    preview.value = 'Flow running...'
                    return (async _ => {
                        log('FlowBuilder Queue button pressed')
                        // TODO: Should fix this by different solution
                        app.graph._nodes.forEach((node) => {
                            node.mode = 0;
                        })
                        await executeAndWaitForTargetNode(app, node);
                        log('Queue finished')
                        preview.value = 'Queue finished!'
                        await new Promise(re => setTimeout(re, 1000)); 
                    
                    })();
                }
            )
    
            const preview = node.addCustomWidget(DEBUG_STRING('Preview', ''))
            preview.parent = node
            
            
            return run_button;
        }

        const addAdvancedFlowWidgets = function(node) {
            const batchSizeWidget = findWidgetByName(node, "batch_size")

            const run_button = node.addWidget(
                'button',
                `Queue`,
                'queue',
                () => {
                    app.canvas.setDirty(true);
                    
                    return (async _ => {
                        log('FlowBuilder Queue button pressed')
                        const style = "margin: 20 20"

                        preview.value = `<div style="${style}"><p>Flow Starting...</p></div>`

                        try {
                            if (disableToggleWidget?.value) {
                                await app.queuePrompt(0, 1);
                                const promptId = await promptIdPromise; 
                                await waitForQueueEnd(promptId);          
                        
                            } else {
                                const totalBatchSize = batchSizeWidget.value;
                                var currBatchSize = 0;
                                // TODO: Should fix this by different solution
                                app.graph._nodes.forEach((node) => {
                                    node.mode = 0;
                                })
                                while (autoQueueToggleWidget.value || currBatchSize < totalBatchSize) {
                                    if (autoQueueToggleWidget.value) {
                                        preview.value = `<div style="${style}"><p>Auto Queue Running</p><br/></div>`
                                        currBatchSize = totalBatchSize;
                                    } else {
                                        currBatchSize += 1;
                                        preview.value = `<div style="${style}"><p>${currBatchSize}/${totalBatchSize} Running...</p><br/><div>`
                                    }
                                    await executeAndWaitForTargetNode(app, node);
                                    log('Queue finished')
                                    await new Promise(re => setTimeout(re, 500)); 
                                }
                            }
                        } catch (error) {
                            console.error(`Error while running queue: ${error}`)

                        } finally {
                            preview.value = `<div style="${style}"><p>Queue finished!</p><br/></div>`
                        }

                    })();
                }
            )

            const preview = node.addCustomWidget(DEBUG_STRING('Preview', ''))
            preview.parent = node

            const disableToggleWidget = node.addWidget("toggle", "Disable Unrelated Nodes", false, "", { "on": 'yes', "off": 'no' });

            disableToggleWidget.doModeChange = (forceValue, skipOtherNodeCheck) => {
                console.log(`toggle changed`)
                
                const toggleValue = disableToggleWidget.value;

                if (toggleValue) {
                    disableToggleWidget.notAlreadyMutedBlacklist = enableOnlyRelatedNodes(node)
                } else if (disableToggleWidget.notAlreadyMutedBlacklist) {
                    for (const node of disableToggleWidget.notAlreadyMutedBlacklist) node.mode = 0;
                } else {
                    app.graph._nodes.forEach((node) => {
                        node.mode = 0;
                    })
                }
            }
            disableToggleWidget.callback = () => {
                disableToggleWidget.doModeChange();
            };

            const autoQueueToggleWidget = node.addWidget("toggle", "Auto Queue", false, "", { "on": 'yes', "off": 'no' });


            node.setSize(node.computeSize());


        }

        let has_custom = false;
        if (nodeData.input && nodeData.input.required) {
            for (const i of Object.keys(nodeData.input.required)) {
                const input_type = nodeData.input.required[i][0];

                if (newTypes.includes(input_type)) {
                    has_custom = true
                    break
                }
            }
        }
        if (has_custom) {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function() {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                this.serialize_widgets = true;
                this.setSize?.(this.computeSize());

                this.onRemoved = function() {
                    shared.cleanupNode(this);
                }
                return r;
            }

            //- Extra menus
            const origGetExtraMenuOptions = nodeType.prototype.getExtraMenuOptions
            nodeType.prototype.getExtraMenuOptions = function (_, options) {
                const r = origGetExtraMenuOptions
                ? origGetExtraMenuOptions.apply(this, arguments)
                : undefined
                if (this.widgets) {
                let toInput = []
                let toWidget = []
                for (const w of this.widgets) {
                    if (w.type === shared.CONVERTED_TYPE) {
                    //- This is already handled by widgetinputs.js
                    // toWidget.push({
                    //     content: `Convert ${w.name} to widget`,
                    //     callback: () => shared.convertToWidget(this, w),
                    // });
                    } else if (newTypes.includes(w.type)) {
                    const config = nodeData?.input?.required[w.name] ||
                        nodeData?.input?.optional?.[w.name] || [w.type, w.options || {}]

                    toInput.push({
                        content: `Convert ${w.name} to input`,
                        callback: () => shared.convertToInput(this, w, config),
                    })
                    }
                }
                if (toInput.length) {
                    options.push(...toInput, null)
                }

                if (toWidget.length) {
                    options.push(...toWidget, null)
                }
                }

                return r
            }
        }

        log("Start setting komojini extension", nodeData.name)

        // Extending Python Nodes
        if (nodeData.name.endsWith("Getter")) {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated
                    ? onNodeCreated.apply(this, arguments)
                    : undefined;
                
                
                var nameSuffix = "";
                if (nodeData.name.includes("Cache")) {
                    nameSuffix = " (cached)";
                }
                
                this.widgets = [];

                this.addWidget(
                    "combo",
                    "key",
                    "",
                    (e) => {
                        this.onRename();
                    },
                    {
                        values: () => {
                            const setterNodes = this.graph._nodes.filter((otherNode) => isSetter(otherNode));
                            return setterNodes.map((otherNode) => otherNode.widgets[0].value).sort();
                        }
                    }
                );

                this.findSetter = function(graph) {
                    const name = this.widgets[0].value;
                    return graph._nodes.find(otherNode => isSetter(otherNode) && otherNode.widgets[0].value === name && name !== '');
                }

                this.setName = function(name) {
                    node.widgets[0].value = name;
                    node.onRename();
                    node.serialize();
                }

                this.setType = function(type) {
                    this.outputs[0].name = type;
                    this.outputs[0].type = type;
                    // this.validateLinks();
                }

                this.onRename = function() {
					const setter = this.findSetter(this.graph);
					if (setter) {
						let linkType = (setter.inputs[0].type);
						
						this.setType(linkType);
						this.title = "Get_" + setter.widgets[0].value + nameSuffix;
						
						if (app.ui.settings.getSettingValue("komojini.NodeAutoColor")){
							setColorAndBgColor.call(this, linkType);	
						}

					} else {
						this.setType('*');
					}
				}
                
                this.size = this.computeSize();
                
                return r;
                
            }
            

        }
        else if (nodeData.name.endsWith("Setter")) {
            const onNodeCreated = nodeType.prototype.onNodeCreated
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated
                    ? onNodeCreated.apply(this, arguments)
                    : undefined;
                const keyValue = findWidgetByName(this, "key").value ?? '';
                const node = this;
                
                if (!this.properties) {
                    this.properties = {
                        "previousName": "",
                    };
                }


                this.defaultVisibility = true;
                this.serialize_widgets = true;
                this.properties.showOutputText = true;

                this.widgets = [];
                this.inputs = [];

                this.addInput("value", "*");

                this.addWidget(
                    "text", 
                    "key", 
                    keyValue, 
                    (s, t, u, v, x) => {
                        // node.validateName(node.graph);
                        if(this.widgets[0].value !== ''){
                            var preFix = ""
                            if (nodeData.name.includes("adv")) {
                                preFix = "🔥(adv) "
                            }
                            else if (nodeData.name.includes("Flow")) {
                                preFix = "🔥 "
                            }
                            this.title = preFix + "Set_" + this.widgets[0].value;
                        }
                        this.update();
                        this.properties.previousName = this.widgets[0].value;
                    }, 
                    {}
                )

                if (nodeData.name.includes("FlowBuilder")) {

                    if ( nodeData.name.includes("adv") ) {
                        addAdvancedFlowWidgets(this);
                    } else {
                        addFlowRunButton(this);
                    }
                }

                this.findGetters = function(graph, checkForPreviousName) {
                    const name = checkForPreviousName ? this.properties.previousName : this.widgets[0].value;
                    return graph._nodes.filter(otherNode => isGetter(otherNode) && otherNode.widgets[0].value === name && name !== '' );
                }

                this.update = function() {
                    if (!node.graph) {
                        return;
                    }
                    
                    try {
                        const getters = this.findGetters(node.graph);
                        getters.forEach(getter => {     
                            if (getter.setType) {      
                                getter.setType?.(this.inputs[0].type);
                            } else {
                                setTypeOtherNode(getter, this.inputs[0].type);
                            }
                        });
                    
                        if (this.widgets[0].value) {
                            const gettersWithPreviousName = this.findGetters(node.graph, true);
                            gettersWithPreviousName.forEach(getter => {
                                
                                if (getter.setName ) {
                                    getter.setName(this.widgets[0].value);
                                } else {
                                    getter.widgets[0].value = this.widgets[0].value; 
                                }
                            });
                        }
                    
                        const allGetters = node.graph._nodes.filter(otherNode => otherNode.type === "GetNode");
                        allGetters.forEach(otherNode => {
                            if (otherNode.setComboValues) {
                                otherNode.setComboValues();
                            }
                        });
                    } catch (error) {
                        console.error(`Failed to update Setter: ${error}`)
                    }
                }

                this.validateName = function(graph) {
                    let widgetValue = node.widgets[0].value;
                
                    if (widgetValue !== '') {
                        let tries = 0;
                        const existingValues = new Set();
                
                        graph._nodes.forEach(otherNode => {
                            if (otherNode !== this && isSetter(otherNode)) {
                                existingValues.add(otherNode.widgets[0].value);
                            }
                        });
                
                        while (existingValues.has(widgetValue)) {
                            widgetValue = node.widgets[0].value + "_" + tries;
                            tries++;
                        }
                
                        node.widgets[0].value = widgetValue;
                        this.update();
                    }
                }

                this.onAdded = function(graph) {
                    this.validateName(graph);
                }

                this.onConnectionsChange = function(
                    slotType,	//1 = input, 2 = output
                    slot,
                    isChangeConnect,
                    link_info,
                    output
                ) {
                    console.log(`Setter node connection`)
                    try {
                        //On Disconnect
                        if (slotType == 1 && !isChangeConnect) {
                            if(this.inputs[slot].name === ''){
                                this.inputs[slot].type = '*';
                                // this.inputs[slot].name = 'value';
                                this.title = "Setter"
                            }
                        }
                        if (slotType == 2 && !isChangeConnect) {
                            this.outputs[slot].type = '*';
                            this.outputs[slot].name = '*';
                            
                        }	
                        //On Connect
                        if (link_info && node.graph && slotType == 1 && isChangeConnect) {
                            console.log("setternode connected");
                            const fromNode = node.graph._nodes.find((otherNode) => otherNode.id == link_info.origin_id);
                            
                            if (fromNode && fromNode.outputs && fromNode.outputs[link_info.origin_slot]) {
                                const type = fromNode.outputs[link_info.origin_slot].type;
                            
                                if (this.title === "Setter" && nodeData.name == "Setter"){
                                    this.title = "Set_" + type;	
                                }
                                if (this.widgets[0].value === '*'){
                                    this.widgets[0].value = type	
                                }
                                
                                this.validateName(node.graph);
                                this.inputs[0].type = type;
                                // this.inputs[0].name = type;
                                
                                if (app.ui.settings.getSettingValue("komojini.NodeAutoColor")){
                                    setColorAndBgColor.call(this, type);	
                                }
                            } else {
                                alert("Error: Set node input undefined. Most likely you're missing custom nodes");
                            }
                        }
                        if (link_info && node.graph && slotType == 2 && isChangeConnect) {
                            const fromNode = node.graph._nodes.find((otherNode) => otherNode.id == link_info.origin_id);
                            
                            if (fromNode && fromNode.inputs && fromNode.inputs[link_info.origin_slot]) {
                                const type = fromNode.inputs[link_info.origin_slot].type;
                                
                                this.outputs[0].type = type;
                                // this.outputs[0].name = type;
                            } else {
                                alert("Error: Get Set node output undefined. Most likely you're missing custom nodes");
                            }
                        }
                    }
                    catch (error) {
                        console.error(`Error onConnectionChange in Setter ${error}`)
                    }
                    //Update either way
                    // this.update();
                }

                this.clone = function () {
                    const cloned = nodeType.prototype.clone.apply(this);
                    cloned.inputs[0].name = 'value';
                    cloned.inputs[0].type = '*';
                    cloned.value = '';
                    cloned.properties.previousName = '';
                    cloned.size = cloned.computeSize();
                    return cloned;
                };
                
                this.onRemoved = () => {
                    const allGetters = this.graph._nodes.filter((otherNode) => isGetter(otherNode));
                    allGetters.forEach((otherNode) => {
                        if (otherNode.setComboValues) {
                            otherNode.setComboValues([this]);
                        }
                    })
                    shared.cleanupNode(this)
                }
                this.inputs[0].name = "value";

                this.size = this.computeSize();

                return r;
            }
        } else if (nodeData.name.startsWith('FlowBuilder' || nodeData.name.endsWith('FlowBuilder')) ) {
                const onNodeCreated = nodeType.prototype.onNodeCreated
                nodeType.prototype.onNodeCreated = function () {
                    const r = onNodeCreated
                      ? onNodeCreated.apply(this, arguments)
                      : undefined
                    
                    this.changeMode(LiteGraph.ALWAYS);

                    if ( nodeData.name.includes("adv")) {
                        console.log(`Advanced Flowbuilder added.`)
                        addAdvancedFlowWidgets(this);
                    } else {
                        console.log(`Flowbuilder added.`)
                        addFlowRunButton(this);
                    }

                    this.onRemoved = () => {
                        shared.cleanupNode(this)
                        app.canvas.setDirty(true)
                    }

                    return r;
            }
        } 
    },
    nodeCreated(node, app) {
        if (node.comfyClass == "DragNUWAImageCanvas") {
            if (!node.properties) {
                node.properties = {}
            }

            const sizes = [
                "576x320",
                "320x576",
                "512x512",
            ];

            console.log(`DragNUWAImageCanvas Created`);
                const w = findWidgetByName(node, "image");
                const dragTextWidget = findWidgetByName(node, "tracking_points")

                shared.hideWidgetForGood(node, w)

                node.addWidget("button", "Get Drag Values", "", () => {
                    openEditorDialog(node)
                })

                console.log(node)
                
                Object.defineProperty(node.properties, "draglines", {
                    set(v) {
                        const newDraglines = [];

                        for (var i = 0; i < v.length; i++) {
                            if (i < v.length - 1 && v[i].length > 1) {
                                newDraglines.push(v[i])
                            } else if (i === v.length - 1) {
                                newDraglines.push(v[i])
                            }
                        }
                        node.properties._draglines = newDraglines;
                    },
                    get() {
                        return node.properties._draglines ?? [];
                    }
                });
                
                Object.defineProperty(w, 'value', {
                    set(v) {
                        if(v != '[IMAGE DATA]' &&  v != "") {
                            const img = new Image();
                            img.onload = function() {
                                console.log(`Set Image value of size(${img.width}x${img.height})`)
                            }
                            img.src = v;
                            w._value = v;
                        }
                    },
                    get() {
                        const stackTrace = new Error().stack;
                        if(!stackTrace.includes('draw') && !stackTrace.includes('graphToPrompt') && stackTrace.includes('app.js')) {
                            return "[IMAGE DATA]";
                        }
                        else {
                            return w._value;
                        }
                    },
                });

                Object.defineProperty(node.properties, "size", {
                    set(v) {
                        node.properties._size = v;
                    },
                    get() {
                        if (node.properties._size) {
                            return node.properties._size;
                        } else {
                            return ["576", "320"]
                        }
                    }
                })

                let set_img_act = (v) => {
                    console.log(`set_img_act`)

                    node._img = v;

                };

                Object.defineProperty(node, "imgs", {
                    set(v) {                        
                        if (!v[0].complete) {
                            let orig_onload = v[0].onload;
                            v[0].onload = function(v2) {
                                if(orig_onload)
                                    orig_onload();
                                set_img_act(v);
                            };
                        }
                        else {
                            set_img_act(v);
                        }
                    },
                    get() {
                        if(node._img == undefined && w.value != '') {
                            node._img = [new Image()];
                            if(w.value && w.value != '[IMAGE DATA]')
                                node._img[0].src = w.value;
                        }
    
                        return node._img;
                    }
                });


                node.closeEditorDialog = function(accept) {
                    node.properties.dialogOpened = false;

                    if (accept) {
            
                    }
                    node.dialog.close()
                }
                
                const openEditorDialog = function(node) {
                    node.properties.dialogOpened = true;
                    node.dialog = new app.ui.dialog.constructor()

                    // node.dialog.element.style.height = "90%";
                    // node.dialog.element.style.width = "90%";
                    // node.dialog.element.style.display = "block";

                    console.log(`Setup dialog size: ${node.dialog.element.width}, ${node.dialog.element.height}`)

                    function setTrackingPoints() {
                        console.log('setTrackingPoints')
                        draglineTextEl.value = JSON.stringify(node.properties.draglines, null, 0)
                    }

                    function setTrackingPointsWidget() {
                        console.log('setTrackingPointsWidget')
                        dragTextWidget.value = JSON.stringify(node.properties.draglines, null, 0)
                    }

                    // node.dialog.element.classList.add('comfy-settings')
                    const closeButton = node.dialog.element.querySelector('button')
                    closeButton.textContent = 'CANCEL'
                    const saveButton = document.createElement('button')
                    saveButton.textContent = 'SAVE'
                    saveButton.onclick = () => {
                        node.closeEditorDialog(true)
                        // _refreshCanvas()
                        
                        node.imgs = [imageNode];

                        setTrackingPoints();
                        setTrackingPointsWidget();

                        if (canvasEl) {
                            const ctx = canvasEl.getContext('2d');
                            _drawImage(node, imageNode, canvasEl, ctx);
                            const base64Img = canvasEl.toDataURL('image/png');
                            w.value = base64Img;
                        }
                    }
                    closeButton.onclick = () => {
                        node.closeEditorDialog(false)
                    }
                    closeButton.before(saveButton)
                    
                    node.properties.newline = true

                    const container = document.createElement("div")

                    container.id = "drag-image-container";
                    // container.style = "display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-around;"

                    Object.assign(container.style, {
                        display: 'flex',
                        gap: '10px',
                        // flexWrap: 'wrap',
                        flexDirection: 'row',
                        // justifyContent: 'space-around',
                      })        

                    
                    // Object.assign(container.style, {
                    //     display: 'flex',
                    //     gap: '10px',
                    //     flexDirection: 'column',
                    //   })
            
                    const imageNode =  document.createElement("img")
                    if (node.imgs) {
                        imageNode.src = node.imgs[0].src
                        imageNode.width = node.imgs[0].width
                        imageNode.height = node.imgs[0].height
                    }
                    imageNode.id = "canvasImage"

            
                    const canvasEl = document.createElement("canvas")
                    canvasEl.id = "imageCanvas"
                    
                    Object.assign(canvasEl, {
                        height: `${node.properties.size[1]}px`,
                        width: `${node.properties.size[0]}px`,
                        style: "border: 1px dotted gray;",
                    })
                    
                    node.properties.canvas = canvasEl;
                    container.append(canvasEl)
                    

                    const _refreshCanvas = () => {
                        
                        shared.infoLogger(`Update Dialog Canvas`)

                        node.properties.newline = true;

                        var ctx             
                        // const canvasEl = document.getElementById("imageCanvas")
                        // const imageNode = document.getElementById("canvasImage")

                        if (canvasEl.getContext) {
                            ctx = canvasEl.getContext("2d")
                        }
                
                        var x=0, y=0, w=imageNode.width, h=imageNode.height;
                        node.properties.size = sizeSelectorEl.value.split("x");
                        // node.properties.size = document.getElementById("sizeSelector").value.split("x");
                        const size = node.properties.size;
            
                        console.log(`Setting canvas size: ${node.properties.size}`)

                        canvasEl.width = size[0];
                        canvasEl.height = size[1];

                        canvasEl.style = `width: ${size[0]}px; height: ${size[1]}px;`
                        canvasEl.style.border = "1px dotted gray"
                        
                        if (!imageNode.width) {
                            console.warn(`No Image node for updating canvas.`)
                        }

                        else if (imageNode.width / imageNode.height > canvasEl.width/canvasEl.height) {
                            y = 0;
                            h = imageNode.height
                            w = imageNode.height * canvasEl.width / canvasEl.height
                            x = (imageNode.width - w) / 2
                        } else {
                            x = 0;
                            w = imageNode.width
                            h = imageNode.width * canvasEl.height / canvasEl.width
                            y = (imageNode.height - h) / 2
                        }
                        ctx.drawImage(imageNode, x, y, w, h, 0, 0, canvasEl.width, canvasEl.height)

                        node.properties.draglines = [];
                        console.log('canvas updated', canvasEl)
                    }
            
            
                    const draglineTextEl = document.createElement("textarea")
                    draglineTextEl.id = "draglinetext"
                    // draglineTextEl.style.height = draglineTextEl.scrollHeight + 'px'; // Set the height to the scrollHeight
                    draglineTextEl.readOnly = true;

                    function _undo() {
                        const newDraglines = [...node.properties.draglines];

                        const lastLine = getLast(newDraglines);
                        lastLine.pop();
                        if (lastLine.length === 0) {
                            newDraglines.pop();
                        }
                        node.properties.draglines = [...newDraglines];
                        drawAllLines(node, node.properties.draglines, imageNode, canvasEl);
                        setTrackingPoints();
                    }
                    
                    function handleKeydown(e) {
                        
                        if (!node.properties.dialogOpened) {
                            return;
                        } 

                        else if (e.key === 'Enter') {
                            setNewline();
                            drawAllLines(node, node.properties.draglines, imageNode, canvasEl);
                        } 
                        else if (e.key === 'Escape') {
                            node.closeEditorDialog(false);
                        }

                        console.log(e);
                    }
                    document.addEventListener('keydown', handleKeydown)
                    
                    canvasEl.addEventListener('mousedown', handleMouseDown)
                    canvasEl.addEventListener('mousemove', handleMouseMove)
                    canvasEl.addEventListener('mouseout', handleMouseOut)
                    
                    function handleMouseOut(e) {
                        console.log("on mouseout");
                        drawAllLines(node, node.properties.draglines, imageNode, canvasEl);
                    }
                    
                    function handleMouseMove(e) {
                        const rect = canvasEl.getBoundingClientRect();
                        const x = Math.round(e.clientX - rect.left);
                        const y = Math.round(e.clientY - rect.top);

                        var currentDraglines;
                        
                        if (node.properties.newline) {
                            currentDraglines = [...node.properties.draglines, [[x, y]]]
                        } else {
                            let prevDragline = getLast(node.properties.draglines) ?? [];
                            currentDraglines = [...node.properties.draglines];
                            currentDraglines[currentDraglines.length -1] = [...prevDragline, [x, y]]
                        }

                        drawAllLines(node, currentDraglines, imageNode, canvasEl);
                        
                    }
                                
                    function handleMouseDown(e) {
                        // Get the mouse coordinates relative to the canvas
                        console.log("mousedown")
                        const rect = canvasEl.getBoundingClientRect();
                        
                        const x = Math.round(e.clientX - rect.left);
                        const y = Math.round(e.clientY - rect.top);
                        // console.log(`${e.clientX} - ${rect.left}, ${e.clientY} - ${rect.top}`)
                        // Now, you have the x, y position relative to the canvas
                        console.log('Mouse Down at:', x, y);
                      
                        // Optionally, you can pass x and y to another function
                        // Do something with x and y, e.g., draw on the canvas
                        // const canvasEl = document.getElementById("imageCanvas")
                        // const imageNode = document.getElementById("canvasImage")
                
                        var ctx             

                        if (canvasEl.getContext) {
                            ctx = canvasEl.getContext("2d")
                        }          

                        if (node.properties.newline) {
                            node.properties.draglines = [...node.properties.draglines, [[x, y]]]
                            node.properties.newline = false;
            
                        } else {
            
                            const prevDragLine = getLast(node.properties.draglines);

                            if (prevDragLine) {
                                prevDragLine.push([x, y])
                            } else {
                                node.properties.draglines = [...node.properties.draglines, [[x, y]]]
                            }
                        }

                        setTrackingPoints();
                        drawAllLines(node, node.properties.draglines, imageNode, canvasEl)
                        // draglineTextEl.value = JSON.stringify(node.properties.draglines, null, 0)
                    }
                    
                    const inputContainer = document.createElement("div")
                    Object.assign(inputContainer.style, {
                        display: 'flex',
                        gap: '10px',
                        flexDirection: 'column',
                    })
                    const sizeSelectorEl = document.createElement("select")
                    sizeSelectorEl.id = "sizeSelector"
                    let sizeOptions = "";
                    sizes.forEach((size) => {
                        const nodeSize = `${node.properties.size[0]}x${node.properties.size[1]}`;
                        if (nodeSize == size) {
                            sizeOptions += `<option value="${size}" selected>${size}</option>`
                        } else {
                            sizeOptions += `<option value="${size}">${size}</option>`
                        }
                        return sizeOptions
                    })
            
                    sizeSelectorEl.insertAdjacentHTML("beforeend", sizeOptions)
                                                                
                    sizeSelectorEl.onchange = _refreshCanvas
            
                    const imageInputEl = document.createElement("input")
                    Object.assign(imageInputEl, {
                        type: "file",
                        id: "inputFile",
                        accept: "image/*",
                    })
                    node.properties.imageNode = imageNode;
            
                    imageInputEl.onchange = function(e) {
                        shared.infoLogger(`Image chosen`)
                        var file = e.target.files[0];
                        var reader = new FileReader();
                        reader.onload = function(e) {
                            shared.infoLogger(`Image onload 1`)
                            // const imageNode = document.getElementById("canvasImage")
                            
                            var img = new Image();

                            img.onload = function() {
                                console.log(`Got image of size ${img.width}x${img.height}`)
                                imageNode.width = img.width;
                                imageNode.height = img.height;
                                var ctx;
                
                                if (canvasEl.getContext) {
                                    ctx = canvasEl.getContext("2d")
                                }

                                imageNode.src = e.target.result;
                                imageNode.onload = function () {
                                    shared.infoLogger(`Image onload 2`)

                                    var x=0,y=0,w=node.width,h=node.height;
                                    const size=document.getElementById("sizeSelector").value.split('x');
                                    canvasEl.width=size[0];
                                    canvasEl.height=size[1];
                                    
                                    refresh();
                                };
                            };
                            img.src = e.target.result;
                        };
                        file && reader.readAsDataURL(file);            
                    }
                    
                    const refresh  = () => {
                        node.properties.newline = true;
                        node.properties.draglines = []
                        draglineTextEl.value = JSON.stringify(node.properties.draglines, null, 0)

                        _refreshCanvas()
                    }
                    const refreshButton = document.createElement("button");
                    refreshButton.textContent = "Refresh"
                    refreshButton.style.margin = "5px 10px"
                    refreshButton.onclick = refresh;

                    function setNewline() {
                        node.properties.newline = true;
                    }

                    const undoButton = document.createElement("button");
                    undoButton.textContent = "Undo"
                    undoButton.style.margin = "5px 10px"
                    undoButton.onclick = _undo;

                    const newlineButton = document.createElement("button");
                    newlineButton.textContent = "New Line (Enter)"
                    newlineButton.style.margin = "5px 10px"
                    newlineButton.onclick = setNewline;
                    newlineButton.width = 100;

                    const controlContainer = document.createElement("div")
                    Object.assign(controlContainer.style, {
                        display: "flex",
                        flexDirection: "column",
                    })

                    const inputStyle = {
                        padding: '5px',
                        margin: '10px'
                    };
                    
                    controlContainer.append(sizeSelectorEl)
                    Object.assign(sizeSelectorEl.style, inputStyle)
                    
                    controlContainer.append(imageInputEl)
                    Object.assign(imageInputEl.style, inputStyle)

                    controlContainer.append(newlineButton)
                    controlContainer.append(undoButton) 
                    controlContainer.append(refreshButton)
            
                    container.append(controlContainer)
                    // container.append(inputContainer)
                
                    node.dialog.show('')
                    node.dialog.textElement.append(container)
                    
                    Object.assign(draglineTextEl.style, {
                        flex: 1,
                        margin: "20px",
                    })
                    controlContainer.append(draglineTextEl)

                    _refreshCanvas()
                    node.properties.draglines = JSON.parse(dragTextWidget.value ?? "[]") ?? [];
                    setTrackingPoints();
                } 
                
                
                shared.log(`Setup dialog`)

            }
        } 
    }


app.registerExtension(komojini_widgets);