"use strict";
/**
 * @license
 * Copyright 2021 The Go Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolTipController = void 0;
/**
 * ToolTipController handles closing tooltips on external clicks.
 */
class ToolTipController {
    el;
    constructor(el) {
        this.el = el;
        document.addEventListener("click", (e) => {
            const insideTooltip = this.el.contains(e.target);
            if (!insideTooltip) {
                this.el.removeAttribute("open");
            }
        });
    }
}
exports.ToolTipController = ToolTipController;
//# sourceMappingURL=_tooltip.js.map