import TestRunner = require("waterline-adapter-tests");
import Adapter = require("./../..");

const runner = new TestRunner({
    adapter: Adapter,
    config: {
        password: "123123",
    },
    interfaces: ["queryable"],
    failOnError: true,
});
