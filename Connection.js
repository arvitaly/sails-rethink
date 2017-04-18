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
class Connection {
    constructor(config) {
        this.config = config;
        this.operations = [];
    }
    execute(operation) {
        const promise = new Promise((resolve, reject) => {
            this.operations.push({
                operation,
                resolve,
                reject,
            });
        });
        this.tick();
        return promise;
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.connection.close();
        });
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            this.connection = yield r.connect({
                host: this.config.host,
                port: this.config.port,
                password: this.config.password,
                db: this.config.database,
            });
        });
    }
    define(tableName) {
        return __awaiter(this, void 0, void 0, function* () {
            const isExists = yield this.execute(r.tableList().contains(tableName));
            let needCreate = false;
            if (this.config.migrate === "drop") {
                if (isExists) {
                    yield this.execute(r.tableDrop(tableName));
                }
                needCreate = true;
            }
            else {
                needCreate = !isExists;
            }
            if (needCreate) {
                yield this.execute(r.tableCreate(tableName));
            }
        });
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
                operation.resolve(result);
            }
            catch (e) {
                operation.reject(e);
            }
        });
    }
}
exports.default = Connection;
