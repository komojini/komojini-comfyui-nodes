import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js"
import { ComfyDialog, $el } from "../../scripts/ui.js";
import * as shared from "./comfy_shared.js";



app.registerExtension({
    name: "komojini.statusviewer",
    init() {

    },
    async setup() {
    
        const menu = document.querySelector(".comfy-menu");

        const separator = document.createElement("hr");

        separator.style.margin = "10px 0";
        separator.style.width = "100%";

        const systemStatus = document.createElement("div");
        systemStatus.id = "systemStatus";
        systemStatus.style.width = "100%";
        systemStatus.style.height = "300";
        systemStatus.style.textAlign = "left";
        systemStatus.style.backgroundColor = "black";
        systemStatus.style.padding = "0 6px";

        const cpuInfoEl = document.createElement("div");
        cpuInfoEl.id = "cpuInfo";
        cpuInfoEl.style.width = "100%";
        cpuInfoEl.style.margin = "8px 0";

        const gpuInfoEl = document.createElement("div");
        gpuInfoEl.id = "gpuInfo";
        gpuInfoEl.style.width = "100%";
        // gpuInfoEl.style.textAlign = "left";

        systemStatus.appendChild(gpuInfoEl);
        systemStatus.appendChild(cpuInfoEl);
        
        function getStyledText(text, style) {
            var styleString = "";
            if (style) {
                for (var styleProp in style) {
                    styleString += `${styleProp}: ${style[styleProp]};`;
                }
            } else {
                return text;
            }
            
            return `<span style="${styleString}">${text}</span>`
        }

        const gpuInfoAttrs = [
            "memoryTotal",
            "memoryUtil", 
            "memoryFree",
            "driver",
            "name",
            "temperature",
            "gpu_usage",
        ];
        
        const gpuTitle = document.createElement("div");
        gpuTitle.innerHTML = getStyledText("GPU", {color: "yellow"});
        gpuTitle.style.margin = "10px 0";
        gpuInfoEl.appendChild(gpuTitle);

        let gpuElements = [];


        const gpuUsageEl = document.createElement("div");
        gpuUsageEl.id = "gpuUsage";
        gpuElements.push(gpuUsageEl)

        const gpuMemoryUsageEl = document.createElement("div");
        gpuMemoryUsageEl.id = "gpuMemoryUsage";
        gpuElements.push(gpuMemoryUsageEl)

        const gpuTemperatureEl = document.createElement("div");
        gpuTemperatureEl.id = "gpuTemperature";
        gpuElements.push(gpuTemperatureEl)

        for (var gpuElement of gpuElements) {
            gpuElement.style.margin = "3px";
            gpuInfoEl.appendChild(gpuElement);
        }


        const cpuTitle = document.createElement("div");
        cpuTitle.textContent = "CPU";
        cpuTitle.style.cssText = "color: yellow;" //background-color: yellow";
        cpuInfoEl.appendChild(cpuTitle);
        
        const cpuUsageEl = document.createElement("div");
        cpuUsageEl.id = "cpuUsageEl";        
        cpuUsageEl.style.margin = "3px";
        cpuInfoEl.appendChild(cpuUsageEl);

        const nameStyle = {
            display: "inline-block",
            width: "30%",
        }
        
        const updateSystemStatus = (data) => {
            
            cpuUsageEl.innerHTML = `${getStyledText("Usage", nameStyle)}: ${getStyledText(data.cpu.cpu_usage, {color: "white"})}${getStyledText("%", {color: "white"})}`;
            const gpuInfo = data.gpus[0];
            gpuTitle.innerHTML = getStyledText("GPU ", {color: "yellow"}) + "<br>" + `(${getStyledText(gpuInfo.name, {"font-size": "8pt"})})`;

            gpuUsageEl.innerHTML =  `${getStyledText("Usage", nameStyle)}: ${getStyledText(gpuInfo.load * 100, {color: "white"})}${getStyledText("%", {color: "white"})}`;

            gpuMemoryUsageEl.innerHTML = `${getStyledText("VRAM", nameStyle)}: 
                ${getStyledText(Math.round(gpuInfo.memoryTotal * gpuInfo.memoryUtil) / 1000, {color: "white"})} / 
                ${getStyledText(Math.round(gpuInfo.memoryTotal / 10) * 10 / 1000, {"font-size": "10pt"})} 
                ${getStyledText("GB", {"font-size": "8pt"})}`;
            gpuTemperatureEl.innerHTML = `${getStyledText("Temp", nameStyle)}: ${getStyledText(gpuInfo.temperature, "white")}°`;
        }

        // Function to fetch and update system status
        async function fetchSystemStatus() {
            try {
                const response = await fetch('/komojini/systemstatus');
                const data = await response.json();

                if (data.cpu !== null || data.gpu !== null) {
                    updateSystemStatus(data);
                }
            } catch (error) {
                console.error('Error fetching system status:', error);
            }
        }

        // Fetch system status initially and every 1 seconds
        fetchSystemStatus();
        setInterval(fetchSystemStatus, 1000);

        menu.append(separator);
        menu.append(systemStatus);
    },
    async beforeRegisterNodeDef(nodeType, nodeData, app) {

    }, 
})