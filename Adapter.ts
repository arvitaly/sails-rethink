import r = require("rethinkdb");
import { Attributes } from "waterline";
import { findCriteriaToExpr } from "./WhereUtil";
interface IOperation {
    operation: r.Operation<any>;
    promiseResolve: any;
    promiseReject: (err: any) => void;
}
class RethinkAdapter {
    public identity = "sails-rethink";
    public adapterApiVersion = 1;
    public syncable: false;
    public defaults = {
        port: 28015,
        host: "localhost",
        password: "",
        migrate: "alter",
    };
    public datastores = {};
    protected operations: IOperation[] = [];
    protected connection: r.Connection;
    protected collections: { [index: string]: any } = {};
    constructor() {
        // this.init();
    }
    public async init(config: any) {
        this.connection = await r.connect({
            host: config.host,
            port: config.port,
            password: config.password,
        });
    }
    public registerConnection = async (
        connection: { identity: string; migrate: "alter" | "drop" | "safe" },
        collections: {
            [index: string]: {
                attributes: Attributes;
            },
        } | null,
        cb: (err?: any) => void) => {
        try {
            await this.init(connection);
            if (connection.migrate === "safe") {
                cb(null);
                return;
            }
            const dbList = await r.dbList().run(this.connection);
            if (dbList.indexOf(connection.identity) === -1) {
                await r.dbCreate(connection.identity).run(this.connection);
            }
            if (collections) {
                let forCreation: string[] = Object.keys(collections);
                if (connection.migrate === "drop") {
                    await Promise.all(Object.keys(collections).map((tableName) =>
                        r.db(connection.identity).tableDrop(tableName).run(this.connection)));
                } else {
                    const tableList = await r.db(connection.identity).tableList().run(this.connection);
                    forCreation = forCreation.filter((tableName) => tableList.indexOf(tableName) === -1);
                }
                await Promise.all(forCreation.map((tableName) =>
                    r.db(connection.identity).tableCreate(tableName).run(this.connection)));
            }
            cb();
        } catch (e) {
            cb(e);
        }
    }
    public registerCollection = (collection, cb: ICallback) => {
        // Keep a reference to this collection
        // _modelReferences[collection.identity] = collection;
        // cb();
        process.exit(1);
    }
    public teardown = (cb: ICallback) => {
        console.log("teardown");
        process.exit(1);
        cb();
    }
    public define = (datastoreName: string, collectionName: string, definition: any, cb: ICallback) => {
        this.collections[collectionName] = definition;
        cb();
    }
    public describe = (
        datastoreName: string, collectionName: string, cb: (error: any, attributes: any) => void, meta: any) => {
        const attributes = null;
        cb(null, attributes);
    }
    public drop = async (datastoreName: string, collectionName: string, relations: any, cb: (err?: any) => void) => {
        try {
            await new Promise((resolve, reject) => {
                this.execute({
                    operation: r.db(datastoreName).tableDrop(collectionName),
                    promiseResolve: resolve,
                    promiseReject: reject,
                });
            });
            cb();
        } catch (e) {
            cb(e);
        }
    }
    public async getAggregateResult(operation: r.Sequence, query: any, funcName: string) {
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
            }
            const r = await new Promise((resolve, reject) => {
                this.execute({
                    operation: newOperation,
                    promiseResolve: resolve,
                    promiseReject: reject,
                });
            });
            result[fieldName] = r;
        }));
        console.log("re", result);
        return result;
    }
    public find = async (
        datastoreName: string, collectionName: string, query: any, cb: (error: any, records?: any[]) => void) => {
        let operation: r.Sequence = r.db(datastoreName).table(collectionName);
        operation = this.addQueryToSequence(operation, query);
        let isGroupBy = false;
        let isAggregate = false;
        if (query.groupBy) {
            operation = operation.group(...query.groupBy);
            isGroupBy = true;
        }
        let result: any;
        if (query.average) {
            result = await this.getAggregateResult(operation, query, "average");
            isAggregate = true;
        } else if (query.sum) {
            result = await this.getAggregateResult(operation, query, "sum");
            isAggregate = true;
        } else {
            const cursor = await new Promise<any>((resolve, reject) => {
                this.execute({
                    operation,
                    promiseResolve: resolve,
                    promiseReject: reject,
                });
            });
            console.log("cursor", cursor);
            result = await cursor.toArray();
            console.log("result", result);
            if (result) {
                console.log("reuslt.length", result.length);
            }
        }
        if (isGroupBy) {
            if (isAggregate) {
                Object.keys(result).map((aggKeyName) => {
                    result = result[aggKeyName].map((v) => {
                        return {
                            [query.groupBy[0]]: v.group,
                            [aggKeyName]: v.reduction,
                        }
                    });
                });
            }
        }
        cb(null, result);
    }
    public addQueryToSequence(operation: r.Sequence, query: any): r.Sequence {
        console.log(query);
        if (query.where) {
            const expr = findCriteriaToExpr(query.where);
            if (expr) {
                operation = operation.filter(expr);
                console.log("expr", expr.toString())
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
        console.log("operation", operation);
        return operation;
    }
    public create = async (datastore: string, collection: string, values: any, cb: (err: any, res?: any) => void) => {
        try {
            const result = await new Promise<r.WriteResult>((resolve, reject) => {
                this.execute({
                    operation: r.db(datastore).table(collection).insert(values),
                    promiseResolve: resolve,
                    promiseReject: reject,
                });
            });
            cb(null, result.inserted);
        } catch (e) {
            cb(e);
        }
    }
    public update = (datastore: string, collection: string, values: any, cb: (err: any, res?: any) => void) => {
        console.log("update", datastore, collection, values);
        process.exit(1);
        // If you need to access your private data for this collection:
        var collection = _modelReferences[collectionName];

        // 1. Filter, paginate, and sort records from the datastore.
        //    You should end up w/ an array of objects as a result.
        //    If no matches were found, this will be an empty array.
        //    
        // 2. Update all result records with `values`.
        // 
        // (do both in a single query if you can-- it's faster)

        // Respond with error or an array of updated records.
        cb(null, []);
    }
    public destroy = async (store: string, collection: string, query: any, cb: (err: any, results?: any) => void) => {
        try {
            const result = await new Promise<r.WriteResult>((resolve, reject) => {
                this.execute({
                    operation: this.addQueryToSequence(r.db(store).table(collection), query).delete(),
                    promiseResolve: resolve,
                    promiseReject: reject,
                });
            });
            cb(null, result.deleted);
        } catch (e) {
            cb(e);
        }
    }
    protected execute(operation: IOperation) {
        this.operations.push(operation);
        this.tick();
    }
    protected async tick() {
        if (!this.connection || !this.connection.open) {
            setTimeout(() => this.tick(), 100);
            return;
        }
        const operation = this.operations.shift();
        if (!operation) {
            return;
        }
        await this.run(operation);
        if (this.operations.length > 0) {
            this.tick();
        }
    }
    protected async run(operation: IOperation) {
        try {
            const result = await operation.operation.run(this.connection);
            operation.promiseResolve(result);
        } catch (e) {
            operation.promiseReject(e);
        }
    }
}
type ICallback = () => void;
export default RethinkAdapter;
