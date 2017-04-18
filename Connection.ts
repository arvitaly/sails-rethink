import r = require("rethinkdb");
export interface IOperation {
    operation: r.Operation<any>;
    resolve: (...args: any[]) => void;
    reject: (err: any) => void;
}
export interface IConfig {
    port?: number;
    host?: string;
    password?: string;
    database?: string;
    migrate: "alter" | "drop" | "safe";
}
class Connection {
    protected connection: r.Connection;
    protected operations: IOperation[] = [];
    constructor(protected config: IConfig) { }
    public execute<T>(operation: r.Operation<T>) {
        const promise = new Promise<T>((resolve, reject) => {
            this.operations.push({
                operation,
                resolve,
                reject,
            });
        });
        this.tick();
        return promise;
    }
    public async close() {
        return await this.connection.close();
    }
    public async connect() {
        this.connection = await r.connect({
            host: this.config.host,
            port: this.config.port,
            password: this.config.password,
            db: this.config.database,
        });
    }
    public async define(tableName: string) {
        const isExists = await this.execute(r.tableList().contains(tableName));
        let needCreate = false;
        if (this.config.migrate === "drop") {
            if (isExists) {
                await this.execute(r.tableDrop(tableName));
            }
            needCreate = true;
        } else {
            needCreate = !isExists;
        }
        if (needCreate) {
            await this.execute(r.tableCreate(tableName));
        }
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
            operation.resolve(result);
        } catch (e) {
            operation.reject(e);
        }
    }
}
export default Connection;
