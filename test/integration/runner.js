"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const TestRunner = require("waterline-adapter-tests");
const Adapter = require("./../..");
const r = require("rethinkdb");
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        const connection = yield r.connect({
            password: "123123",
        });
        try {
            yield r.dbDrop("queryable").run(connection);
        }
        catch (e) {
            // IGNORE
        }
        const runner = new TestRunner({
            adapter: Adapter,
            config: {
                password: "123123",
            },
            interfaces: ["queryable"],
            failOnError: true,
        });
    });
}
start();
