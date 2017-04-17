import r = require("rethinkdb");
import { Attributes } from "waterline";
interface IOperation {
    operation: r.Operation<any>;
    promiseResolve: any;
    promiseReject: (err: any) => void;
}
class RethinkAdapter implements IAdapter {
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
    public find = async (
        datastoreName: string, collectionName: string, query: any, cb: (error: any, records?: any[]) => void) => {
        console.log(query);
        let operation: r.Sequence = r.db(datastoreName).table(collectionName);
        if (query.where) {
            const conditions = Object.keys(query.where).map((fieldName) => {
                switch (this.collections[collectionName][fieldName].type) {
                    case "string":
                        return r.row(fieldName).downcase().eq(query.where[fieldName]);
                    default:
                        return r.row(fieldName).eq(query.where[fieldName]);
                }
            });
            const condition = conditions.shift();
            if (condition) {
                let expr: r.Expression<boolean> = condition;
                conditions.map((cond) => expr = expr.and(cond));
                console.log(expr.toString());
                operation = operation.filter(expr);
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
        // console.log("query.where", query);
        // operation = r.db('queryable').table('userTable2').orderBy(...["age"]);
        try {
            const cursor = await new Promise<any>((resolve, reject) => {
                this.execute({
                    operation,
                    promiseResolve: resolve,
                    promiseReject: reject,
                });
            });
            cursor.toArray((err: any, result: any) => {
                if (err) { cb(err); return; }
                console.log("result", result.length);
                cb(null, result);
                // console.log(JSON.stringify(result, null, 2));
            });
        } catch (e) {
            cb(e);
        }
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
    public destroy = (collectionName, options, cb) => {

        // If you need to access your private data for this collection:
        var collection = _modelReferences[collectionName];


        // 1. Filter, paginate, and sort records from the datastore.
        //    You should end up w/ an array of objects as a result.
        //    If no matches were found, this will be an empty array.
        //    
        // 2. Destroy all result records.
        // 
        // (do both in a single query if you can-- it's faster)

        // Return an error, otherwise it's declared a success.
        cb();
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
