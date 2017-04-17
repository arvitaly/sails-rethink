import r = require("rethinkdb");
export function findCriteriaToExpr(criteria: { [index: string]: any }) {
    let conditions: Array<r.Expression<any>> = [];
    Object.keys(criteria).map((criteriaName) => {
        if (criteriaName === "or") {
            const exprs = (criteria[criteriaName] as any[]).map((c) => findCriteriaToExpr(c));
            let firstExpr = exprs.shift();
            if (firstExpr) {
                exprs.map((e) => {
                    if (e) {
                        firstExpr = (firstExpr as r.Expression<any>).or(e);
                    }
                });
                conditions = conditions.concat(firstExpr);
            }
        } else {
            conditions = conditions.concat(findCriteriaFieldToExpr(criteriaName, criteria[criteriaName]));
        }
    });
    const condition = conditions.shift();
    if (condition) {
        let expr: r.Expression<boolean> = condition;
        conditions.map((cond) => expr = expr.and(cond));
        return expr;
    }
}
function isDate(value: string) {
    try {
        const d = new Date(value);
        return !!d.getTime();
    } catch (e) {
        return false;
    }
}
export function findCriteriaFieldToExpr(fieldName: string, field: { [index: string]: any } | string) {
    let expr = r.row(fieldName);
    if (typeof (field) === "string") {
        if (isDate(field)) {
            expr = expr.eq(new Date(field));
        } else {
            expr = expr.downcase().eq(field.toLowerCase());
        }
    } else {
        if (fieldName === "like") {
            const realFieldName = Object.keys(field)[0];
            const value = "^" + escape(field[realFieldName].toLowerCase()).replace(/\*/gi, ".")
                .replace(/%/gi, ".*") + "$";
            return r.row(realFieldName).downcase().match(value);
        }
        const conditions = Object.keys(field).map((modificator) => {
            let value = field[modificator];
            if (typeof (value) === "string") {
                if (!isDate(value)) {
                    expr = expr.downcase();
                    value = value.toLowerCase();
                } else {
                    value = new Date(value);
                }
            }
            switch (modificator) {
                case "<":
                case "lessThan":
                    return expr.lt(value);
                case "<=":
                case "lessThanOrEqual":
                    return expr.le(value);
                case ">":
                case "greaterThan":
                    return expr.gt(value);
                case ">=":
                case "greaterThanOrEqual":
                    return expr.ge(value);
                case "!":
                case "not":
                    return expr.not();
                case "like":
                    return expr.match("^" + escape(value).replace(/\*/gi, ".")
                        .replace(/%/gi, ".*") + "$");
                case "contains":
                    return expr.match(escape(value));
                case "startsWith":
                    return expr.match("^" + escape(value));
                case "endsWith":
                    return expr.match(escape(value) + "$");
                default:
                    throw new Error("Unknown find modificator: " + modificator);
            }
        });
        const condition = conditions.shift();
        if (condition) {
            expr = condition;
            conditions.map((cond) => expr = expr.and(cond));
        }
        return expr;
    }
    return expr;
}

function escape(s: string) {
    return String(s).replace(/[\\^$*+?.()|[\]{}]/g, "\\$&"); // .replace(/\\/gi, "\\\\");
}
