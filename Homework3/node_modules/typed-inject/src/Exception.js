"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Exception extends Error {
    constructor(message, innerError) {
        super(`${message}${innerError ? `. Inner error: ${innerError.message}` : ''}`);
        this.innerError = innerError;
    }
}
exports.Exception = Exception;
//# sourceMappingURL=Exception.js.map