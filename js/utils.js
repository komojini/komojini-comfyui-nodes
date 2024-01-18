import { api } from '/scripts/api.js'
import * as shared from './comfy_shared.js'
import { app } from '/scripts/app.js'



export const findWidgetByName = (node, name) => {
    return node.widgets ? node.widgets.find((w) => w.name === name) : null;
}

export const doesInputWithNameExist = (node, name) => {
    return node.inputs ? node.inputs.some((input) => input.name === name) : false;
}

export const findWidgetsByType = (node, type) => {
    var widgets = [];
    node.widgets.map((widget) => {
        if (widget.type === type) {
            widgets.push(widget);
        }
    });
    return widgets;
}

export const getNodeByLink = (linkId, type) => app.graph.getNodeById(app.graph.links[linkId][type == "input" ? "origin_id" : "target_id"]);

export function enableOnlyRelatedNodes(targetNode) {
    let whitelist = {};

    function travelBackward(node) {
        whitelist[node.id] = node;
        if (!node.inputs) return;
        for (const input of node.inputs) {
            if (!input.link) continue
            travelBackward(getNodeByLink(input.link, "input"));
        }
    }

    function travelForward(node) {
        whitelist[node.id] = node;
        travelBackward(node);
        if (!node.outputs) return;
        for (const output of node.outputs) {
            if (!output.links) continue;
            for (const link of output.links) {
                travelForward(getNodeByLink(link, "output"));
            }
        }
    }

    travelForward(targetNode);

    let notAlreadyMutedBlacklist = app.graph._nodes.filter(node => node.mode !== 2 && !whitelist[node.id]);
    for (const node of notAlreadyMutedBlacklist) node.mode = 2;
    return notAlreadyMutedBlacklist;
}

export function waitForPromptId() {
    const originalFetch = window.fetch;
    return new Promise(resolve => {
        window.fetch = async (...args) => {
            let [url, config] = args;
            const response = await originalFetch(url, config);
            if (url === "/prompt") {
                response.clone().json().then(data => resolve(data.prompt_id));
                window.fetch = originalFetch;
            }
            return response;
        };
    })
}

//https://github.com/melMass/comfy_mtb/blob/main/web/mtb_widgets.js#L309
//Thanks for cool text box.
export const DEBUG_STRING = (name, val) => {
    const fontSize = 16
    const w = {
        name,
        type: 'debug_text',

        draw: function (ctx, node, widgetWidth, widgetY, height) {
            // const [cw, ch] = this.computeSize(widgetWidth)
            shared.offsetDOMWidget(this, ctx, node, widgetWidth, widgetY, height)
        },
        computeSize: function (width) {
            const value = this.inputEl.innerHTML
            if (!value) {
                return [32, 32]
            }
            if (!width) {
                log(`No width ${this.parent.size}`)
            }

            const oldFont = app.ctx.font
            app.ctx.font = `${fontSize}px monospace`

            const words = value.split(' ')
            const lines = []
            let currentLine = ''
            for (const word of words) {
                const testLine =
                    currentLine.length === 0 ? word : `${currentLine} ${word}`

                const testWidth = app.ctx.measureText(testLine).width

                if (testWidth > width) {
                    lines.push(currentLine)
                    currentLine = word
                } else {
                    currentLine = testLine
                }
            }
            app.ctx.font = oldFont
            if (lines.length === 0) lines.push(currentLine)

            const textHeight = (lines.length + 1) * fontSize

            const maxLineWidth = lines.reduce(
                (maxWidth, line) =>
                    Math.max(maxWidth, app.ctx.measureText(line).width),
                0
            )
            const widgetWidth = Math.max(width || this.width || 32, maxLineWidth)
            const widgetHeight = textHeight * 1.5
            return [widgetWidth, widgetHeight]
        },
        onRemoved: function () {
            if (this.inputEl) {
                this.inputEl.remove()
            }
        },
    }

    Object.defineProperty(w, 'value', {
        get() {
            return this.inputEl.innerHTML
        },
        set(value) {
            this.inputEl.innerHTML = value
            this.parent?.setSize?.(this.parent?.computeSize())
        },
    })

    w.inputEl = document.createElement('p')
    w.inputEl.style.textAlign = 'center'
    w.inputEl.style.fontSize = `${fontSize}px`
    w.inputEl.style.color = 'var(--input-text)'
    w.inputEl.style.lineHeight = 0

    w.inputEl.style.fontFamily = 'monospace'
    w.value = val
    document.body.appendChild(w.inputEl)

    return w
}