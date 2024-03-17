"use strict";
/**
 * @license
 * Copyright 2023 The Go Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const d3 = __importStar(require("d3"));
const Plot = __importStar(require("@observablehq/plot"));
for (const program of Page.Charts.Programs) {
    for (const counter of program.Charts) {
        switch (counter.Type) {
            case "partition":
                document
                    .querySelector(`[data-chart-id="${counter.ID}"]`)
                    ?.append(partition(counter));
                break;
            case "histogram":
                document
                    .querySelector(`[data-chart-id="${counter.ID}"]`)
                    ?.append(histogram(counter));
                break;
            default:
                console.error("unknown chart type");
                break;
        }
    }
}
function partition({ Data, Name }) {
    Data ??= [];
    return Plot.plot({
        color: {
            type: "ordinal",
            scheme: "Spectral",
        },
        nice: true,
        x: {
            label: Name,
            labelOffset: Number.MAX_SAFE_INTEGER,
            tickRotate: 45,
            domain: Data.map((d) => d.Key),
        },
        y: {
            label: "Frequency",
            domain: [0, 1],
        },
        width: 1024,
        style: "overflow:visible;background:transparent;margin-bottom:3rem;",
        marks: [
            Plot.barY(Data, {
                tip: true,
                fill: (d) => (isNaN(Number(d.Key)) ? d.Key : Number(d.Key)),
                x: (d) => d.Key,
                y: (d) => d.Value,
            }),
            Plot.frame(),
        ],
    });
}
function histogram({ Data }) {
    Data ??= [];
    const n = 3; // number of facet columns
    const fixKey = (k) => (isNaN(Number(k)) ? k : Number(k));
    const keys = Array.from(d3.union(Data.map((d) => fixKey(d.Key))));
    const index = new Map(keys.map((key, i) => [key, i]));
    const fx = (key) => (index.get(key) ?? 0) % n;
    const fy = (key) => Math.floor((index.get(key) ?? 0) / n);
    return Plot.plot({
        marginLeft: 60,
        width: 1024,
        grid: true,
        nice: true,
        x: {
            label: "Distribution",
        },
        color: {
            type: "ordinal",
            legend: true,
            scheme: "Spectral",
            label: "Counter",
        },
        y: {
            insetTop: 16,
            domain: [0, 1],
        },
        fx: {
            ticks: [],
        },
        fy: {
            ticks: [],
        },
        style: "background:transparent;",
        marks: [
            Plot.barY(Data, Plot.binX({ y: "proportion-facet", x: "x1", interval: 0.1, cumulative: 1 }, {
                tip: true,
                fill: (d) => fixKey(d.Key),
                x: (d) => d.Value,
                fx: (d) => fx(fixKey(d.Key)),
                fy: (d) => fy(fixKey(d.Key)),
            })),
            Plot.text(keys, {
                frameAnchor: "top",
                dy: 3,
                fx,
                fy,
            }),
            Plot.axisX({ anchor: "bottom", tickSpacing: 35 }),
            Plot.axisX({ anchor: "top", tickSpacing: 35 }),
            Plot.frame(),
        ],
    });
}
//# sourceMappingURL=charts.js.map