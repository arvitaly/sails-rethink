"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const WhereUtil_1 = require("./../../WhereUtil");
describe("WhereUtil tests", () => {
    it("when criteria is plain object, should expect", () => {
        const expr = WhereUtil_1.findCriteriaToExpr({
            field1: { lessThan: 15 },
            field2: { lessThanOrEqual: 25 },
            field3: { greaterThan: 40.8 },
            field4: { greaterThanOrEqual: "xo", like: "m16575" },
            field5: { not: new Date(), like: "%hel%l%o", contains: "cont1", startsWith: "ho", endsWith: "ar" },
        });
        expect(expr.toString()).toMatchSnapshot();
    });
    it("when criteria is or, should expect", () => {
        const expr = WhereUtil_1.findCriteriaToExpr({
            or: [{
                    test: "x",
                    field: 1.1,
                }, {
                    m: 16,
                    m2: "f1"
                }],
        });
        expect(expr.toString()).toMatchSnapshot();
    });
});
