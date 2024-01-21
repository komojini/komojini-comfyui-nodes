

import { app } from '../../scripts/app.js'
import { api } from '../../scripts/api.js'

import { log } from './comfy_shared.js'
import * as shared from './comfy_shared.js'
import { DEBUG_STRING, findWidgetByName, isSetter, isGetter, setColorAndBgColor } from './utils.js'
import { executeAndWaitForTargetNode } from './komojini.chain.js'


const END_EMOJI = '🔥';

const newTypes = [ 'BUTTON']

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

    setup: () => {},

    getCustomWidgets: function() {
        return {
            // BOOL: (node, inputName, inputData, app) => {
            //     console.debug('Registering bool')
        
            //     return {
            //       widget: node.addCustomWidget(
            //         MtbWidgets.BOOL(inputName, inputData[1]?.default || false)
            //       ),
            //       minWidth: 150,
            //       minHeight: 30,
            //     }
            //   },
        
            //   COLOR: (node, inputName, inputData, app) => {
            //     console.debug('Registering color')
            //     return {
            //       widget: node.addCustomWidget(
            //         MtbWidgets.COLOR(inputName, inputData[1]?.default || '#ff0000')
            //       ),
            //       minWidth: 150,
            //       minHeight: 30,
            //     }
            //   },
              // BBOX: (node, inputName, inputData, app) => {
              //     console.debug("Registering bbox")
              //     return {
              //         widget: node.addCustomWidget(MtbWidgets.BBOX(inputName, inputData[1]?.default || [0, 0, 0, 0])),
              //         minWidth: 150,
              //         minHeight: 30,
              //     }
        
              // }
        }
    },
    /**
     * @param {import("./types/comfy").NodeType} nodeType
     * @param {import("./types/comfy").NodeDef} nodeData
     * @param {import("./types/comfy").App} app
     */
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        const node = this;

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
        if (nodeData.name.startsWith('FlowBuilder' || nodeData.name.endsWith('FlowBuilder')) ) {
                const onNodeCreated = nodeType.prototype.onNodeCreated
                nodeType.prototype.onNodeCreated = function () {
                    const r = onNodeCreated
                      ? onNodeCreated.apply(this, arguments)
                      : undefined
                    
                    this.changeMode(LiteGraph.ALWAYS);

                    const onReset = () => {
                        app.canvas.setDirty(true)
                        preview.value = ''
                    }
                    // const reset_button = this.addWidget(
                    //     'button',
                    //     `Reset`,
                    //     'reset',
                    //     onReset
                    // )

                    const run_button = this.addWidget(
                        'button',
                        `Queue`,
                        'queue',
                        () => {
                            onReset()
                            preview.value = 'Flow running...'
                            return (async _ => {
                                log('FlowBuilder Queue button pressed')
                                app.graph._nodes.forEach((node) => {
                                    node.mode = 0;
                                })
                                await executeAndWaitForTargetNode(app, this);
                                log('Queue finished')
                                preview.value = 'Queue finished!'
                                await new Promise(re => setTimeout(re, 1000));
                            })();
                        }
                    )

                    const preview = this.addCustomWidget(DEBUG_STRING('Preview', ''))
                    preview.parent = this

                    // preview.afterQueued = function() {
                    //     preview.value = 'Flow running...'
                    // }
                    this.onRemoved = () => {
                        shared.cleanupNode(this)
                        app.canvas.setDirty(true)
                    }

                    return r;
            }
        } else if (nodeData.name.endsWith("Getter")) {
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
						
						if (app.ui.settings.getSettingValue("KJNodes.nodeAutoColor")){
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
                            this.title = "Set_" + this.widgets[0].value;
                        }
                        this.update();
                        this.properties.previousName = this.widgets[0].value;
                    }, 
                    {}
                )

                this.findGetters = function(graph, checkForPreviousName) {
                    const name = checkForPreviousName ? this.properties.previousName : this.widgets[0].value;
                    return graph._nodes.filter(otherNode => isGetter(otherNode) && otherNode.widgets[0].value === name && name !== '' );
                }

                this.update = function() {
                    if (!node.graph) {
                        return;
                    }
                
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
                            if (getter.setName) {
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
                    console.log(slotType, slot, isChangeConnect, link_info, output);
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
                        
                            if (this.title === "Setter"){
                                this.title = "Set_" + type;	
                            }
                            if (this.widgets[0].value === '*'){
                                this.widgets[0].value = type	
                            }
                            
                            this.validateName(node.graph);
                            this.inputs[0].type = type;
                            // this.inputs[0].name = type;
                            
                            if (app.ui.settings.getSettingValue("KJNodes.nodeAutoColor")){
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


                    //Update either way
                    this.update();
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
                }
                this.inputs[0].name = "value";

                this.size = this.computeSize();

                return r;
            }
        } 
    }
}

app.registerExtension(komojini_widgets)