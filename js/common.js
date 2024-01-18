import { api } from "../../scripts/api.js";
import { app } from "../../scripts/app.js";
import { findWidgetByName } from "./utils.js";


let original_show = app.ui.dialog.show;


function nodeUpdateNodeHandler(event) {
    let nodes = app.graph._nodes_by_id;
    let node = nodes[event.detail.node_id];
    if (node) {
        const widget = findWidgetByName(event.detail.widget_name);
        if (widget) {
            widget.value = event.detail.value;
        }
    }
}

api.addEventListener("komojini-update-node", nodeUpdateNodeHandler);


function addQueue(event) {
    app.queuePrompt(0, 1);
}

api.addEventListener("komojini-add-queue", addQueue);