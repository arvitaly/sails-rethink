import TestRunner = require("waterline-adapter-tests");
import Adapter = require("./../..");
import r = require("rethinkdb");

async function start() {
    const connection = await r.connect({
        password: "123123",
    });
    try {
        await r.dbDrop("queryable").run(connection);
    } catch (e) {
        // IGNORE
    }
    const runner = new TestRunner({
        adapter: Adapter as any,
        config: {
            password: "123123",
        },
        interfaces: ["queryable"],
        failOnError: true,
    });
}
start();
