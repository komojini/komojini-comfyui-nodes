import { ComfyWidgets } from "../../scripts/widgets.js";
import { app } from "../../scripts/app.js";
import * as shared from "./comfy_shared.js";


class DragNUWAImageCanvas extends LiteGraph.LGraghNode {
    title = "DragNUWACanvas"
    category = "komojini/image"

    color = LGraphCanvas.node_colors.yellow.color
    bgcolor = LGraphCanvas.node_colors.yellow.bgcolor
    groupcolor = LGraphCanvas.node_colors.yellow.groupcolor

    constructor() {
        super()
        this.uuid = shared.makeUUID()

        shared.log(`Constructing DRAGNUWACanvas instance`)

        this.collapsable = true
        this.isVirtualNode = true
        this.shape = LiteGraph.BOX_SHAPE
        this.serialize_widgets = true

        const inner = document.createElement("div")
        inner.style.margin = "0"
        inner.style.padding = "0"
        inner.style.pointerEvents = "none"

        this.calculatedHeight = 0

        this.htmlWidget = this.addDOMWidget("HTML", "html", inner, {
            setValue: (val) => {
                this._raw_html = val
            },
            getValue: () => this._raw_html,
            getMinHeight: () => this.calculatedHeight,
            hideOnZoom: false,
        })

        this.setupDialog()
    }

    setupDialog() {
        this.dialog = new app.ui.dialog.constructor()
        this.dialog.element.classList.add('comfy-settings')

        const closeButton = this.dialog.element.querySelector('button')
        closeButton.textContent = 'CANCEL'
        const saveButton = document.createElement('button')
        saveButton.textContent = 'SAVE'
        saveButton.onclick = () => {
        this.closeEditorDialog(true)
        }
        closeButton.onclick = () => {
        this.closeEditorDialog(false)
        }
        closeButton.before(saveButton)
    }

    openEditorDialog() {
        const container = document.createElement("div")
        
        Object.assign(container.style, {
            display: 'flex',
            gap: '10px',
            flexDirection: 'column',
          })
      
        const editorsContainer = document.createElement('div')
        Object.assign(editorsContainer.style, {
        display: 'flex',
        gap: '10px',
        flexDirection: 'row',
        })
    
        container.append(editorsContainer)
    
        this.dialog.show('')
        this.dialog.textElement.append(container)
    }

    onCreate() {}
    onNodeCreated() {}
    onRemoved() {}
    getExtraMenuOptions() {}
    setMode(mode) {}

}

const komojiniCanvas = {
    name: "komojini.image",
    init: async () => {},
    setup: () => {},
    async beforeRegisterNodeDef(nodeType, nodeData, app) {},

    registerCustomNodes() {

        LiteGraph.registerNodeType("DragNUWAImageCanvas", DragNUWAImageCanvas)
        
        DragNUWAImageCanvas.title_mode = LiteGraph.NO_TITLE

        TestNode.category = "komojini.canvas";
    },
}

app.registerExtension(komojiniCanvas)
