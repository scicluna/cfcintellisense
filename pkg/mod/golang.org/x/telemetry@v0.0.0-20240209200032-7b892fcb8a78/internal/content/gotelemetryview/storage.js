"use strict";
/**
 * @license
 * Copyright 2023 The Go Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 */
Object.defineProperty(exports, "__esModule", { value: true });
(function () {
    const closedSections = localStorage.getItem("closed-sections") ?? "";
    const html = document.querySelector("html");
    html?.setAttribute("data-closed-sections", closedSections);
})();
//# sourceMappingURL=storage.js.map