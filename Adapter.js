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
const r = require("rethinkdb");
const WhereUtil_1 = require("./WhereUtil");
class RethinkAdapter {
    constructor() {
        this.identity = "sails-rethink";
        this.adapterApiVersion = 1;
        this.defaults = {
            port: 28015,
            host: "localhost",
            password: "",
            migrate: "alter",
            database: "",
        };
        this.datastores = {};
        this.operations = [];
        this.collections = {};
        this.dbName = "test";
        this.registerConnection = (connection, collections, cb) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.init(connection);
                if (connection.migrate === "safe") {
                    cb(null);
                    return;
                }
                const dbList = yield r.dbList().run(this.connection);
                if (dbList.indexOf(connection.identity) === -1) {
                    yield r.dbCreate(connection.identity).run(this.connection);
                }
                if (collections) {
                    let forCreation = Object.keys(collections);
                    if (connection.migrate === "drop") {
                        yield Promise.all(Object.keys(collections).map((tableName) => r.db(this.dbName).tableDrop(tableName).run(this.connection)));
                    }
                    else {
                        const tableList = yield r.db(this.dbName).tableList().run(this.connection);
                        forCreation = forCreation.filter((tableName) => tableList.indexOf(tableName) === -1);
                    }
                    yield Promise.all(forCreation.map((tableName) => r.db(this.dbName).tableCreate(tableName).run(this.connection)));
                }
                cb();
            }
            catch (e) {
                cb(e);
            }
        });
        this.teardown = (cb) => __awaiter(this, void 0, void 0, function* () {
            if (this.connection) {
                yield this.connection.close();
            }
            cb();
        });
        this.define = (datastoreName, collectionName, definition, cb) => {
            this.collections[collectionName] = definition;
            cb();
        };
        this.describe = (datastoreName, collectionName, cb, meta) => {
            const attributes = null;
            cb(null, attributes);
        };
        this.drop = (datastoreName, collectionName, relations, cb) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield new Promise((resolve, reject) => {
                    this.execute({
                        operation: r.db(this.dbName).tableDrop(collectionName),
                        promiseResolve: resolve,
                        promiseReject: reject,
                    });
                });
                cb();
            }
            catch (e) {
                cb(e);
            }
        });
        this.find = (datastoreName, collectionName, query, cb) => __awaiter(this, void 0, void 0, function* () {
            let operation = r.db(this.dbName).table(collectionName);
            operation = this.addQueryToSequence(operation, query);
            let isGroupBy = false;
            let isAggregate = false;
            if (query.groupBy) {
                operation = operation.group(...query.groupBy);
                isGroupBy = true;
            }
            let result;
            if (query.average) {
                result = yield this.getAggregateResult(operation, query, "average");
                isAggregate = true;
            }
            else if (query.sum) {
                result = yield this.getAggregateResult(operation, query, "sum");
                isAggregate = true;
            }
            else {
                const cursor = yield new Promise((resolve, reject) => {
                    this.execute({
                        operation,
                        promiseResolve: resolve,
                        promiseReject: reject,
                    });
                });
                this.log("cursor", cursor);
                result = yield cursor.toArray();
                this.log("result", result);
                if (result) {
                    this.log("reuslt.length", result.length);
                }
            }
            if (isGroupBy) {
                if (isAggregate) {
                    Object.keys(result).map((aggKeyName) => {
                        result = result[aggKeyName].map((v) => {
                            return {
                                [query.groupBy[0]]: v.group,
                                [aggKeyName]: v.reduction,
                            };
                        });
                    });
                }
            }
            cb(null, result);
        });
        this.create = (datastore, collection, values, cb) => __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield new Promise((resolve, reject) => {
                    this.execute({
                        operation: r.db(this.dbName).table(collection).insert(values),
                        promiseResolve: resolve,
                        promiseReject: reject,
                    });
                });
                cb(null, result.inserted);
            }
            catch (e) {
                cb(e);
            }
        });
        this.update = (datastore, collection, values, cb) => __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield new Promise((resolve, reject) => {
                    this.execute({
                        operation: r.db(this.dbName).table(collection).update(values),
                        promiseResolve: resolve,
                        promiseReject: reject,
                    });
                });
                cb(null, result.inserted);
            }
            catch (e) {
                cb(e);
            }
        });
        this.destroy = (store, collection, query, cb) => __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield new Promise((resolve, reject) => {
                    this.execute({
                        operation: this.addQueryToSequence(r.db(this.dbName).table(collection), query).delete(),
                        promiseResolve: resolve,
                        promiseReject: reject,
                    });
                });
                cb(null, result.deleted);
            }
            catch (e) {
                cb(e);
            }
        });
        // this.init();
    }
    init(config) {
        return __awaiter(this, void 0, void 0, function* () {
            this.connection = yield r.connect({
                host: config.host,
                port: config.port,
                password: config.password,
            });
            this.dbName = config.database;
        });
    }
    getAggregateResult(operation, query, funcName) {
        return __awaiter(this, void 0, void 0, function* () {
            let fields;
            if (query[funcName] instanceof Array) {
                fields = query[funcName];
            }
            else {
                fields = [query[funcName]];
            }
            const result = {};
            yield Promise.all(fields.map((fieldName) => __awaiter(this, void 0, void 0, function* () {
                let newOperation;
                switch (funcName) {
                    case "average":
                        newOperation = operation.avg(fieldName);
                        break;
                    case "sum":
                        newOperation = operation.sum(fieldName);
                        break;
                    default:
                }
                const r = yield new Promise((resolve, reject) => {
                    this.execute({
                        operation: newOperation,
                        promiseResolve: resolve,
                        promiseReject: reject,
                    });
                });
                result[fieldName] = r;
            })));
            this.log("re", result);
            return result;
        });
    }
    addQueryToSequence(operation, query) {
        this.log(query);
        if (query.where) {
            const expr = WhereUtil_1.findCriteriaToExpr(query.where);
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
    execute(operation) {
        this.operations.push(operation);
        this.tick();
    }
    tick() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.connection || !this.connection.open) {
                setTimeout(() => this.tick(), 100);
                return;
            }
            const operation = this.operations.shift();
            if (!operation) {
                return;
            }
            yield this.run(operation);
            if (this.operations.length > 0) {
                this.tick();
            }
        });
    }
    run(operation) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield operation.operation.run(this.connection);
                operation.promiseResolve(result);
            }
            catch (e) {
                operation.promiseReject(e);
            }
        });
    }
    log(...args) {
        console.log.apply(console, args);
    }
}
exports.default = RethinkAdapter;
