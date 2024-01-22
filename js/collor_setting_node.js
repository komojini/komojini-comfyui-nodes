import { app } from '../../scripts/app.js'
import { api } from '../../scripts/api.js'

import { log } from './comfy_shared.js'


class ColorSettingNode {
    defaultVisibility = true;
    serialize_widgets = true;
    constructor() {
        if (!this.properties) {
            this.properties = {};
        }

        const node = this;

        this.addWidget(
            "button",
            "Add Color",
            "",
            () => {
                
            }
        )
    }

}