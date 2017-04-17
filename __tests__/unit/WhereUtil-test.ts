import r = require("rethinkdb");
import { findCriteriaToExpr } from "./../../WhereUtil";

describe("WhereUtil tests", () => {
    it("when criteria is plain object, should expect", () => {
        const expr = findCriteriaToExpr({
            field1: { lessThan: 15 },
            field2: { lessThanOrEqual: 25 },
            field3: { greaterThan: 40.8 },
            field4: { greaterThanOrEqual: "xo", like: "m16575" },
            field5: { not: new Date(), like: "%hel%l%o", contains: "cont1", startsWith: "ho", endsWith: "ar" },
        });
        expect((expr as any).toString()).toMatchSnapshot();
    });
    it("when criteria is or, should expect", () => {
        const expr = findCriteriaToExpr({
            or: [{
                test: "x",
                field: 1.1,
            }, {
                m: 16,
                m2: "f1",
            }],
        });
        expect((expr as any).toString()).toMatchSnapshot();
    });
});
