import r = require("rethinkdb");

async function start() {
    const connection = await r.connect({
        password: "123123",
    });
    console.log( r.row("first_name").downcase().match("ar\\)h\\$daxx$").and(r.row("type").downcase().eq("case sensitivity")).toString());
    const result = await r.db("queryable").table("userTable2").filter(
        r.row("first_name").downcase().match("ar\\)h\\$daxx$").and(r.row("type").downcase().eq("case sensitivity"))
    ).run(connection);
    console.log(await result.toArray());
}
start();
