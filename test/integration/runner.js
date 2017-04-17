"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TestRunner = require("waterline-adapter-tests");
const Adapter = require("./../..");
const runner = new TestRunner({
    adapter: Adapter,
    config: {
        password: "123123",
    },
    interfaces: ["queryable"],
    failOnError: true,
});
