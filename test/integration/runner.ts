import TestRunner = require("waterline-adapter-tests");
import Adapter = require("./../..");
import r = require("rethinkdb");

async function start() {
    const connection = await r.connect({
        password: "123123",
        db: "sailstest",
    });
    try {
        await r.dbDrop("sailstest").run(connection);
    } catch (e) {
        // IGNORE
    }
    await r.dbCreate("sailstest").run(connection);
    const runner = new TestRunner({
        adapter: Adapter as any,
        config: {
            password: "123123",
            database: "sailstest",
        },
        interfaces: ["queryable"],
        failOnError: true,
    });
}
start();
