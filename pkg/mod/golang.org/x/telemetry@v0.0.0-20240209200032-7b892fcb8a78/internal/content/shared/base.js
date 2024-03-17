"use strict";
/**
 * @license
 * Copyright 2023 The Go Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const _tooltip_1 = require("./_tooltip");
for (const el of document.querySelectorAll(".js-tooltip")) {
    new _tooltip_1.ToolTipController(el);
}
//# sourceMappingURL=base.js.map