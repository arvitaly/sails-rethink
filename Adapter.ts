import r = require("rethinkdb");
import { Attributes } from "waterline";
import Connection from "./Connection";
import { findCriteriaToExpr } from "./WhereUtil";

class RethinkAdapter {
    public identity = "sails-rethink";
    // public adapterApiVersion = 1; // TODO
    public syncable: false;
    public defaults = {
        port: 28015,
        host: "localhost",
        password: "",
        migrate: "alter",
        database: "",
    };
    public connections: { [index: string]: Connection } = {};

    public registerConnection = async (
        connectionConfig: { identity: string; migrate: "alter" | "drop" | "safe" },
        collections: {
            [index: string]: {
                attributes: Attributes;
            },
        } | null,
        cb: (err?: any) => void) => {
        const connection = new Connection(connectionConfig);
        this.connections[connectionConfig.identity] = connection;
        await connection.connect();
        cb();
    }
    public teardown = async (identity: string, cb: (err?: any) => void) => {
        if (this.connections[identity]) {
            await this.connections[identity].close();
        }
        cb();
    }
    public define = async (conn: string, collectionName: string, definition: any, cb: (err?: any) => void) => {
        try {
            await this.connections[conn].define(collectionName);
            cb();
        } catch (e) {
            cb(e);
        }
    }
    public describe = (conn: string, collectionName: string, cb: (error: any, attributes: any) => void, meta: any) => {
        cb(null, null);  // send null for attributes, because database not has schema
    }
    public drop = async (connection: string, collectionName: string, relations: any, cb: (err?: any) => void) => {
        try {
            const result = await this.connections[connection].execute(r.tableDrop(collectionName));
            cb();
        } catch (e) {
            cb(e);
        }
    }
    public async getAggregateResult(conn: Connection, operation: r.Sequence, query: any, funcName: string) {
        let fields: string[];
        if (query[funcName] instanceof Array) {
            fields = query[funcName];
        } else {
            fields = [query[funcName]];
        }
        const result: any = {};
        await Promise.all(fields.map(async (fieldName) => {
            let newOperation: r.Aggregator;
            switch (funcName) {
                case "average":
                    newOperation = operation.avg(fieldName);
                    break;
                case "sum":
                    newOperation = operation.sum(fieldName);
                    break;
                default:
                    throw new Error("Unknown aggregate function: " + funcName);
            }
            const r = await conn.execute(newOperation);
            result[fieldName] = r;
        }));
        this.log("re", result);
        return result;
    }
    public find = async (conn: string, collection: string, query: any, cb: (error: any, records?: any[]) => void) => {
        let operation: r.Sequence = r.table(collection);
        operation = this.addQueryToSequence(operation, query);
        let isGroupBy = false;
        let isAggregate = false;
        if (query.groupBy) {
            operation = operation.group(...query.groupBy);
            isGroupBy = true;
        }
        let result: any;
        if (query.average) {
            result = await this.getAggregateResult(this.connections[conn], operation, query, "average");
            isAggregate = true;
        } else if (query.sum) {
            result = await this.getAggregateResult(this.connections[conn], operation, query, "sum");
            isAggregate = true;
        } else {
            const cursor = await this.connections[conn].execute(operation);
            this.log("cursor", cursor);
            result = await cursor.toArray();
            this.log("result", result);
            if (result) {
                this.log("reuslt.length", result.length);
            }
        }
        if (isGroupBy) {
            if (isAggregate) {
                Object.keys(result).map((aggKeyName) => {
                    result = result[aggKeyName].map((v: any) => {
                        return {
                            [query.groupBy[0]]: v.group,
                            [aggKeyName]: v.reduction,
                        };
                    });
                });
            }
        }
        cb(null, result);
    }
    public addQueryToSequence(operation: r.Sequence, query: any): r.Sequence {
        this.log(query);
        if (query.where) {
            const expr = findCriteriaToExpr(query.where);
            if (expr) {
                operation = operation.filter(expr);
                this.log("expr", expr.toString());
            }
        }
        if (query.sort) {
            const orderBy = Object.keys(query.sort).map((fieldName) => {
                return query.sort[fieldName] === 1 ? fieldName : r.desc(fieldName);
            });
            // console.log("orderBy", orderBy[0]);
            operation = operation.orderBy(...orderBy);
        }
        if (query.limit) {
            operation = operation.limit(query.limit);
        }
        if (query.skip) {
            operation = operation.skip(query.skip);
        }
        this.log("operation", operation);
        return operation;
    }
    public create = async (conn: string, collection: string, values: any, cb: (err: any, res?: any) => void) => {
        try {
            const result = await this.connections[conn].execute(r.table(collection).insert(values));
            cb(null, result.inserted);
        } catch (e) {
            cb(e);
        }
    }
    public update = async (conn: string, collection: string, values: any, cb: (err: any, res?: any) => void) => {
        try {
            const result = await this.connections[conn].execute(r.table(collection).update(values));
            cb(null, result.replaced);
        } catch (e) {
            cb(e);
        }
    }
    public destroy = async (conn: string, collection: string, query: any, cb: (err: any, results?: any) => void) => {
        try {
            const result = await this.connections[conn].execute(
                this.addQueryToSequence(r.table(collection), query).delete());
            cb(null, result.replaced);
        } catch (e) {
            cb(e);
        }
    }
    protected log(...args: any[]) {
        console.log.apply(console, args);
    }
}
export default RethinkAdapter;
