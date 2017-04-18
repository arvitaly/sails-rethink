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
const Connection_1 = require("./Connection");
const WhereUtil_1 = require("./WhereUtil");
class RethinkAdapter {
    constructor() {
        this.identity = "sails-rethink";
        this.defaults = {
            port: 28015,
            host: "localhost",
            password: "",
            migrate: "alter",
            database: "",
        };
        this.connections = {};
        this.registerConnection = (connectionConfig, collections, cb) => __awaiter(this, void 0, void 0, function* () {
            const connection = new Connection_1.default(connectionConfig);
            this.connections[connectionConfig.identity] = connection;
            yield connection.connect();
            cb();
        });
        this.teardown = (identity, cb) => __awaiter(this, void 0, void 0, function* () {
            if (this.connections[identity]) {
                yield this.connections[identity].close();
            }
            cb();
        });
        this.define = (conn, collectionName, definition, cb) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.connections[conn].define(collectionName);
                cb();
            }
            catch (e) {
                cb(e);
            }
        });
        this.describe = (conn, collectionName, cb, meta) => {
            cb(null, null); // send null for attributes, because database not has schema
        };
        this.drop = (connection, collectionName, relations, cb) => __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.connections[connection].execute(r.tableDrop(collectionName));
                cb();
            }
            catch (e) {
                cb(e);
            }
        });
        this.find = (conn, collection, query, cb) => __awaiter(this, void 0, void 0, function* () {
            let operation = r.table(collection);
            operation = this.addQueryToSequence(operation, query);
            let isGroupBy = false;
            let isAggregate = false;
            if (query.groupBy) {
                operation = operation.group(...query.groupBy);
                isGroupBy = true;
            }
            let result;
            if (query.average) {
                result = yield this.getAggregateResult(this.connections[conn], operation, query, "average");
                isAggregate = true;
            }
            else if (query.sum) {
                result = yield this.getAggregateResult(this.connections[conn], operation, query, "sum");
                isAggregate = true;
            }
            else {
                const cursor = yield this.connections[conn].execute(operation);
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
        this.create = (conn, collection, values, cb) => __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.connections[conn].execute(r.table(collection).insert(values));
                cb(null, result.inserted);
            }
            catch (e) {
                cb(e);
            }
        });
        this.update = (conn, collection, values, cb) => __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.connections[conn].execute(r.table(collection).update(values));
                cb(null, result.replaced);
            }
            catch (e) {
                cb(e);
            }
        });
        this.destroy = (conn, collection, query, cb) => __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.connections[conn].execute(this.addQueryToSequence(r.table(collection), query).delete());
                cb(null, result.replaced);
            }
            catch (e) {
                cb(e);
            }
        });
    }
    getAggregateResult(conn, operation, query, funcName) {
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
                        throw new Error("Unknown aggregate function: " + funcName);
                }
                const r = yield conn.execute(newOperation);
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
    log(...args) {
        console.log.apply(console, args);
    }
}
exports.default = RethinkAdapter;
