"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const r = require("rethinkdb");
function findCriteriaToExpr(criteria) {
    let conditions = [];
    Object.keys(criteria).map((criteriaName) => {
        if (criteriaName === "or") {
            const exprs = criteria[criteriaName].map((c) => findCriteriaToExpr(c));
            let firstExpr = exprs.shift();
            if (firstExpr) {
                exprs.map((e) => {
                    if (e) {
                        firstExpr = firstExpr.or(e);
                    }
                });
                conditions = conditions.concat(firstExpr);
            }
        }
        else {
            conditions = conditions.concat(findCriteriaFieldToExpr(criteriaName, criteria[criteriaName]));
        }
    });
    const condition = conditions.shift();
    if (condition) {
        let expr = condition;
        conditions.map((cond) => expr = expr.and(cond));
        return expr;
    }
}
exports.findCriteriaToExpr = findCriteriaToExpr;
function isDate(value) {
    try {
        const d = new Date(value);
        return !!d.getTime();
    }
    catch (e) {
        return false;
    }
}
function findCriteriaFieldToExpr(fieldName, field) {
    let expr = r.row(fieldName);
    if (typeof (field) === "string") {
        if (isDate(field)) {
            expr = expr.eq(new Date(field));
        }
        else {
            expr = expr.downcase().eq(field.toLowerCase());
        }
    }
    else {
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
                }
                else {
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
exports.findCriteriaFieldToExpr = findCriteriaFieldToExpr;
function escape(s) {
    return String(s).replace(/[\\^$*+?.()|[\]{}]/g, "\\$&"); // .replace(/\\/gi, "\\\\");
}
