declare module "waterline-adapter-tests" {
    interface IAdapter {
        find: (datastoreName: string, query: any, cb: (error: any, records: any[]) => void) => void;
    }
    interface TestRunner {

    }
    interface IDefaultConfig {
        [index: string]: any;
        schema?: boolean;
        migrate?: "alter" | "drop" | "safe";
    }
    interface ITestRunnerOpts {
        adapter: IAdapter;
        config?: IDefaultConfig;
        interfaces: Array<"semantic" | "queryable">;
        failOnError?: boolean;
    }
    interface TestRunnerStatic {
        new (opts: ITestRunnerOpts): TestRunner;
    }
    const value: TestRunnerStatic;
    export = value;
}
declare module "rethinkdb" {
    interface Expression<T> {
        downcase(): Expression<T>;
        upper(): Expression<T>;
        match(expr: string): Expression<T>;
    }
    interface Sequence {
        avg(filter: string): Aggregator;
        sum(filter: string): Aggregator;
        group(...aggregators: Aggregator[]): Sequence;
    }
    interface Aggregator extends Operation<any> {

    }
}