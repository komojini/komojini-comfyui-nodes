

import { app } from '../../scripts/app.js'
import { api } from '../../scripts/api.js'

import { log } from './comfy_shared.js'
import * as shared from './comfy_shared.js'
import { DEBUG_STRING, findWidgetByName } from './utils.js'
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
        if (nodeData.name.startsWith('FlowBuilder')) {
                log("FlowBuilder added")
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
                    const reset_button = this.addWidget(
                        'button',
                        `Reset`,
                        'reset',
                        onReset
                    )

                    const run_button = this.addWidget(
                        'button',
                        `Queue`,
                        'queue',
                        () => {
                            onReset()
                            return (async _ => {
                                log('Queue button pressed')
                                await executeAndWaitForTargetNode(app, this);
                                log('Queue finished')
                                preview.value = 'Queue finished!'
                                await new Promise(re => setTimeout(re, 1000000));
                            })();
                        }
                    )

                    const preview = this.addCustomWidget(DEBUG_STRING('Preview', ''))
                    preview.parent = this

                    preview.afterQueued = function() {
                        preview.value = 'Flow running...'
                    }
                    this.onRemoved = () => {
                        shared.cleanupNode(this)
                        app.canvas.setDirty(true)
                    }

                    return r;
            }
        }
    }
}

app.registerExtension(komojini_widgets)