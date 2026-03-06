import {
    QueryBuilderState,
    SelectColumn,
    FilterCondition,
    JoinClause,
    OrderByClause,
    AggregateFunction,
} from './types';

export class QueryBuilder {
    /**
     * Generates SQL SELECT query from the query builder state
     */
    static generateSQL(state: QueryBuilderState, dbType: 'mysql' | 'postgresql' = 'postgresql'): string {
        const parts: string[] = [];

        // SELECT clause
        parts.push(this.buildSelectClause(state, dbType));

        // FROM clause
        parts.push(this.buildFromClause(state, dbType));

        // JOIN clauses
        if (state.joins.length > 0) {
            parts.push(this.buildJoinClauses(state.joins, dbType, state.schema));
        }

        // WHERE clause
        if (state.filters.length > 0) {
            parts.push(this.buildWhereClause(state.filters, dbType));
        }

        // GROUP BY clause
        if (state.groupBy.length > 0) {
            parts.push(this.buildGroupByClause(state.groupBy, dbType));
        }

        // ORDER BY clause
        if (state.orderBy.length > 0) {
            parts.push(this.buildOrderByClause(state.orderBy, dbType));
        }

        // LIMIT clause
        if (state.limit !== undefined) {
            parts.push(`LIMIT ${state.limit}`);
        }

        // OFFSET clause
        if (state.offset !== undefined) {
            parts.push(`OFFSET ${state.offset}`);
        }

        return parts.join('\n') + ';';
    }

    private static buildSelectClause(state: QueryBuilderState, dbType: string): string {
        const distinct = state.distinct ? 'DISTINCT ' : '';

        if (state.selectColumns.length === 0) {
            return `SELECT ${distinct}*`;
        }

        const columns = state.selectColumns.map(col => {
            let columnExpr = this.quoteIdentifier(col.column, dbType);

            // Apply aggregate function if specified
            if (col.aggregate && col.aggregate !== 'NONE') {
                columnExpr = `${col.aggregate}(${columnExpr})`;
            }

            // Add alias if specified
            if (col.alias) {
                columnExpr += ` AS ${this.quoteIdentifier(col.alias, dbType)}`;
            }

            return columnExpr;
        });

        return `SELECT ${distinct}${columns.join(', ')}`;
    }

    private static buildFromClause(state: QueryBuilderState, dbType: string): string {
        let tableName = this.quoteIdentifier(state.table, dbType);

        // Add schema prefix for PostgreSQL
        if (dbType === 'postgresql' && state.schema) {
            tableName = `${this.quoteIdentifier(state.schema, dbType)}.${tableName}`;
        }

        return `FROM ${tableName}`;
    }

    private static buildJoinClauses(joins: JoinClause[], dbType: string, schema?: string): string {
        return joins.map(join => {
            let joinTable = this.quoteIdentifier(join.table, dbType);
            // Add schema prefix for PostgreSQL
            if (dbType === 'postgresql' && schema) {
                joinTable = `${this.quoteIdentifier(schema, dbType)}.${joinTable}`;
            }
            const leftCol = this.quoteIdentifier(join.leftColumn, dbType);
            const rightCol = this.quoteIdentifier(join.rightColumn, dbType);

            return `${join.type} JOIN ${joinTable} ON ${leftCol} = ${rightCol}`;
        }).join('\n');
    }

    private static buildWhereClause(filters: FilterCondition[], dbType: string): string {
        if (filters.length === 0) {
            return '';
        }

        const conditions = filters.map((filter, index) => {
            const column = this.quoteIdentifier(filter.column, dbType);
            let condition = '';

            // Handle NULL operators specially
            if (filter.operator === 'IS NULL' || filter.operator === 'IS NOT NULL') {
                condition = `${column} ${filter.operator}`;
            }
            // Handle IN and NOT IN operators
            else if (filter.operator === 'IN' || filter.operator === 'NOT IN') {
                // Parse comma-separated values
                const values = filter.value.split(',').map(v => this.escapeValue(v.trim()));
                condition = `${column} ${filter.operator} (${values.join(', ')})`;
            }
            // Handle LIKE operators
            else if (filter.operator === 'LIKE' || filter.operator === 'NOT LIKE') {
                condition = `${column} ${filter.operator} ${this.escapeValue(filter.value)}`;
            }
            // Handle standard comparison operators
            else {
                condition = `${column} ${filter.operator} ${this.escapeValue(filter.value)}`;
            }

            // Add logical operator between conditions (default to AND)
            if (index < filters.length - 1) {
                const logicalOp = filter.logicalOperator || 'AND';
                condition += ` ${logicalOp}`;
            }

            return condition;
        });

        return `WHERE ${conditions.join(' ')}`;
    }

    private static buildGroupByClause(groupBy: string[], dbType: string): string {
        const columns = groupBy.map(col => this.quoteIdentifier(col, dbType));
        return `GROUP BY ${columns.join(', ')}`;
    }

    private static buildOrderByClause(orderBy: OrderByClause[], dbType: string): string {
        // Sort by priority first
        const sorted = [...orderBy].sort((a, b) => a.priority - b.priority);

        const columns = sorted.map(clause => {
            const column = this.quoteIdentifier(clause.column, dbType);
            return `${column} ${clause.direction}`;
        });

        return `ORDER BY ${columns.join(', ')}`;
    }

    private static quoteIdentifier(identifier: string, dbType: string): string {
        if (dbType === 'mysql') {
            return `\`${identifier.replace(/`/g, '``')}\``;
        } else {
            // PostgreSQL
            return `"${identifier.replace(/"/g, '""')}"`;
        }
    }

    private static escapeValue(value: string): string {
        // If the value is already quoted, return as is
        if (value.startsWith("'") && value.endsWith("'")) {
            return value;
        }

        // Check if it's a number
        if (!isNaN(Number(value))) {
            return value;
        }

        // Escape single quotes and wrap in quotes
        return `'${value.replace(/'/g, "''")}'`;
    }

    /**
     * Validates the query builder state
     */
    static validate(state: QueryBuilderState): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Table name is required
        if (!state.table || state.table.trim() === '') {
            errors.push('Table name is required');
        }

        // Validate LIMIT (must be positive integer)
        if (state.limit !== undefined && (state.limit < 0 || !Number.isInteger(state.limit))) {
            errors.push('LIMIT must be a positive integer');
        }

        // Validate OFFSET (must be non-negative integer)
        if (state.offset !== undefined && (state.offset < 0 || !Number.isInteger(state.offset))) {
            errors.push('OFFSET must be a non-negative integer');
        }

        // Validate filters
        for (const filter of state.filters) {
            if (!filter.column || filter.column.trim() === '') {
                errors.push('Filter column cannot be empty');
            }

            // Check if value is required for this operator
            const nullOperators = ['IS NULL', 'IS NOT NULL'];
            if (!nullOperators.includes(filter.operator) && !filter.value) {
                errors.push(`Filter value is required for operator "${filter.operator}"`);
            }
        }

        // Validate joins
        for (const join of state.joins) {
            if (!join.table || !join.leftColumn || !join.rightColumn) {
                errors.push('Join requires table, left column, and right column');
            }
        }

        // Validate ORDER BY
        for (const order of state.orderBy) {
            if (!order.column || order.column.trim() === '') {
                errors.push('ORDER BY column cannot be empty');
            }
        }

        // If using aggregate functions, should have GROUP BY or all columns should be aggregated
        const hasAggregates = state.selectColumns.some(col => col.aggregate && col.aggregate !== 'NONE');
        const hasNonAggregates = state.selectColumns.some(col => !col.aggregate || col.aggregate === 'NONE');

        if (hasAggregates && hasNonAggregates && state.groupBy.length === 0) {
            errors.push('When using aggregate functions with non-aggregated columns, you must specify GROUP BY');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Creates an empty query builder state for a table
     */
    static createEmptyState(table: string, schema?: string): QueryBuilderState {
        return {
            table,
            schema,
            distinct: false,
            selectColumns: [],
            filters: [],
            joins: [],
            orderBy: [],
            groupBy: []
        };
    }

    /**
     * Parses a SELECT query back into builder state.
     * Handles SELECT columns (with aggregates/aliases), WHERE, JOINs, ORDER BY, GROUP BY, LIMIT, OFFSET.
     */
    static parseSQL(sql: string, dbType: 'mysql' | 'postgresql' = 'postgresql', schema?: string): QueryBuilderState | null {
        try {
            sql = sql.trim().replace(/;\s*$/, '').trim();

            if (!/^SELECT\b/i.test(sql)) {
                return null;
            }

            const state: QueryBuilderState = {
                table: '',
                schema: schema,
                distinct: /^SELECT\s+DISTINCT\b/i.test(sql),
                selectColumns: [],
                filters: [],
                joins: [],
                orderBy: [],
                groupBy: []
            };

            // Extract LIMIT
            const limitMatch = sql.match(/\bLIMIT\s+(\d+)/i);
            if (limitMatch) {
                state.limit = parseInt(limitMatch[1]);
            }

            // Extract OFFSET
            const offsetMatch = sql.match(/\bOFFSET\s+(\d+)/i);
            if (offsetMatch) {
                state.offset = parseInt(offsetMatch[1]);
            }

            // Extract SELECT columns (between SELECT [DISTINCT] and FROM)
            const selectMatch = sql.match(/^SELECT\s+(?:DISTINCT\s+)?([\s\S]*?)\s+FROM\b/i);
            if (!selectMatch) {
                return null;
            }
            const selectClause = selectMatch[1].trim();

            // Parse FROM table
            const idPattern = dbType === 'mysql' ? '`[^`]+`|\\w+' : '"[^"]+"|\\w+';
            const fromRegex = new RegExp(
                `\\bFROM\\s+(?:(${idPattern})\\s*\\.\\s*)?(${idPattern})`,
                'i'
            );
            const fromMatch = sql.match(fromRegex);
            if (!fromMatch) {
                return null;
            }

            if (fromMatch[1]) {
                state.schema = this.unquoteIdentifier(fromMatch[1], dbType);
            }
            state.table = this.unquoteIdentifier(fromMatch[2], dbType);

            // Parse SELECT columns
            if (selectClause !== '*') {
                const columnExprs = this.splitByComma(selectClause);
                for (const expr of columnExprs) {
                    const col = this.parseSelectColumn(expr.trim(), dbType);
                    if (col) {
                        state.selectColumns.push(col);
                    }
                }
            }

            // Parse JOINs
            const joinRegex = new RegExp(
                `(INNER|LEFT|RIGHT|FULL)\\s+JOIN\\s+(?:(?:${idPattern})\\s*\\.\\s*)?(${idPattern})\\s+ON\\s+(${idPattern})\\s*=\\s*(${idPattern})`,
                'gi'
            );
            let joinMatch;
            while ((joinMatch = joinRegex.exec(sql)) !== null) {
                state.joins.push({
                    type: joinMatch[1].toUpperCase() as JoinClause['type'],
                    table: this.unquoteIdentifier(joinMatch[2], dbType),
                    leftColumn: this.unquoteIdentifier(joinMatch[3], dbType),
                    rightColumn: this.unquoteIdentifier(joinMatch[4], dbType)
                });
            }

            // Parse WHERE clause
            const whereMatch = sql.match(/\bWHERE\s+([\s\S]*?)(?=\s+GROUP\s+BY\b|\s+ORDER\s+BY\b|\s+LIMIT\b|\s+OFFSET\b|$)/i);
            if (whereMatch) {
                state.filters = this.parseWhereClause(whereMatch[1].trim(), dbType);
            }

            // Parse GROUP BY
            const groupByMatch = sql.match(/\bGROUP\s+BY\s+([\s\S]*?)(?=\s+ORDER\s+BY\b|\s+LIMIT\b|\s+OFFSET\b|$)/i);
            if (groupByMatch) {
                const groupCols = this.splitByComma(groupByMatch[1].trim());
                state.groupBy = groupCols.map(c => this.unquoteIdentifier(c.trim(), dbType));
            }

            // Parse ORDER BY
            const orderByMatch = sql.match(/\bORDER\s+BY\s+([\s\S]*?)(?=\s+LIMIT\b|\s+OFFSET\b|$)/i);
            if (orderByMatch) {
                const orderParts = this.splitByComma(orderByMatch[1].trim());
                state.orderBy = orderParts.map((part, index) => {
                    const tokens = part.trim().split(/\s+/);
                    const column = this.unquoteIdentifier(tokens[0], dbType);
                    const direction = (tokens.length > 1 && tokens[1].toUpperCase() === 'DESC') ? 'DESC' : 'ASC';
                    return { column, direction: direction as OrderByClause['direction'], priority: index };
                });
            }

            return state;
        } catch (error) {
            console.error('Error parsing SQL:', error);
            return null;
        }
    }

    /**
     * Unquotes an identifier by removing surrounding quotes (backticks for MySQL, double quotes for PostgreSQL).
     */
    private static unquoteIdentifier(s: string, dbType: string): string {
        s = s.trim();
        if (dbType === 'mysql' && s.startsWith('`') && s.endsWith('`')) {
            return s.slice(1, -1).replace(/``/g, '`');
        }
        if (s.startsWith('"') && s.endsWith('"')) {
            return s.slice(1, -1).replace(/""/g, '"');
        }
        return s;
    }

    /**
     * Unquotes a string value by removing surrounding single quotes.
     */
    private static unquoteValue(s: string): string {
        s = s.trim();
        if (s.startsWith("'") && s.endsWith("'")) {
            return s.slice(1, -1).replace(/''/g, "'");
        }
        return s;
    }

    /**
     * Splits a string by commas, respecting parentheses and single-quoted strings.
     */
    private static splitByComma(s: string): string[] {
        const result: string[] = [];
        let depth = 0;
        let current = '';
        let inString = false;

        for (let i = 0; i < s.length; i++) {
            const ch = s[i];

            if (inString) {
                current += ch;
                if (ch === "'" && s[i + 1] === "'") {
                    current += s[++i]; // escaped single quote
                } else if (ch === "'") {
                    inString = false;
                }
                continue;
            }

            if (ch === "'") {
                inString = true;
                current += ch;
            } else if (ch === '(') {
                depth++;
                current += ch;
            } else if (ch === ')') {
                depth--;
                current += ch;
            } else if (ch === ',' && depth === 0) {
                result.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }

        if (current.trim()) {
            result.push(current.trim());
        }

        return result;
    }

    /**
     * Parses a single SELECT column expression like:
     *   "col", COUNT("col"), "col" AS "alias", COUNT("col") AS "alias"
     */
    private static parseSelectColumn(expr: string, dbType: string): SelectColumn | null {
        // Pattern for aggregate: AGG(column) [AS alias]
        const aggRegex = /^(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*([\s\S]*?)\s*\)\s*(?:AS\s+(.+))?$/i;
        const aggMatch = expr.match(aggRegex);
        if (aggMatch) {
            return {
                column: this.unquoteIdentifier(aggMatch[2], dbType),
                aggregate: aggMatch[1].toUpperCase() as AggregateFunction,
                alias: aggMatch[3] ? this.unquoteIdentifier(aggMatch[3], dbType) : undefined
            };
        }

        // Pattern for column AS alias
        const aliasRegex = /^(.+?)\s+AS\s+(.+)$/i;
        const aliasMatch = expr.match(aliasRegex);
        if (aliasMatch) {
            return {
                column: this.unquoteIdentifier(aliasMatch[1], dbType),
                aggregate: 'NONE',
                alias: this.unquoteIdentifier(aliasMatch[2], dbType)
            };
        }

        // Plain column
        return {
            column: this.unquoteIdentifier(expr, dbType),
            aggregate: 'NONE',
            alias: undefined
        };
    }

    /**
     * Parses a WHERE clause into an array of FilterConditions.
     * Splits on AND/OR at the top level (outside parentheses and strings).
     */
    private static parseWhereClause(clause: string, dbType: string): FilterCondition[] {
        const conditions: string[] = [];
        const logicOps: string[] = [];
        let condStart = 0;
        let pDepth = 0;
        let inStr = false;
        let i = 0;

        while (i < clause.length) {
            const ch = clause[i];

            if (inStr) {
                if (ch === "'" && clause[i + 1] === "'") {
                    i += 2;
                } else if (ch === "'") {
                    inStr = false;
                    i++;
                } else {
                    i++;
                }
                continue;
            }

            if (ch === "'") {
                inStr = true;
                i++;
                continue;
            }

            if (ch === '(') { pDepth++; i++; continue; }
            if (ch === ')') { pDepth--; i++; continue; }

            if (pDepth === 0) {
                // Check for AND/OR (must be surrounded by whitespace)
                const remaining = clause.substring(i);
                const andMatch = remaining.match(/^\s+(AND)\s+/i);
                const orMatch = remaining.match(/^\s+(OR)\s+/i);

                if (andMatch) {
                    conditions.push(clause.substring(condStart, i).trim());
                    logicOps.push('AND');
                    condStart = i + andMatch[0].length;
                    i = condStart;
                    continue;
                }
                if (orMatch) {
                    conditions.push(clause.substring(condStart, i).trim());
                    logicOps.push('OR');
                    condStart = i + orMatch[0].length;
                    i = condStart;
                    continue;
                }
            }

            i++;
        }

        // Add last condition
        conditions.push(clause.substring(condStart).trim());

        // Parse each condition into a FilterCondition
        const filters: FilterCondition[] = [];
        for (let j = 0; j < conditions.length; j++) {
            const cond = conditions[j].trim();
            if (!cond) continue;

            const filter = this.parseSingleCondition(cond, dbType);
            if (filter) {
                if (j < logicOps.length) {
                    filter.logicalOperator = logicOps[j] as FilterCondition['logicalOperator'];
                }
                filters.push(filter);
            }
        }

        return filters;
    }

    /**
     * Parses a single WHERE condition like: "col" = 'value', "col" IS NULL, "col" IN (1, 2)
     */
    private static parseSingleCondition(cond: string, dbType: string): FilterCondition | null {
        // IS NOT NULL
        const isNotNullMatch = cond.match(/^(.+?)\s+IS\s+NOT\s+NULL\s*$/i);
        if (isNotNullMatch) {
            return {
                column: this.unquoteIdentifier(isNotNullMatch[1], dbType),
                operator: 'IS NOT NULL',
                value: ''
            };
        }

        // IS NULL
        const isNullMatch = cond.match(/^(.+?)\s+IS\s+NULL\s*$/i);
        if (isNullMatch) {
            return {
                column: this.unquoteIdentifier(isNullMatch[1], dbType),
                operator: 'IS NULL',
                value: ''
            };
        }

        // NOT IN
        const notInMatch = cond.match(/^(.+?)\s+NOT\s+IN\s*\(\s*([\s\S]*?)\s*\)\s*$/i);
        if (notInMatch) {
            const values = this.splitByComma(notInMatch[2]).map(v => this.unquoteValue(v.trim()));
            return {
                column: this.unquoteIdentifier(notInMatch[1], dbType),
                operator: 'NOT IN',
                value: values.join(', ')
            };
        }

        // IN
        const inMatch = cond.match(/^(.+?)\s+IN\s*\(\s*([\s\S]*?)\s*\)\s*$/i);
        if (inMatch) {
            const values = this.splitByComma(inMatch[2]).map(v => this.unquoteValue(v.trim()));
            return {
                column: this.unquoteIdentifier(inMatch[1], dbType),
                operator: 'IN',
                value: values.join(', ')
            };
        }

        // NOT LIKE
        const notLikeMatch = cond.match(/^(.+?)\s+NOT\s+LIKE\s+([\s\S]+)$/i);
        if (notLikeMatch) {
            return {
                column: this.unquoteIdentifier(notLikeMatch[1], dbType),
                operator: 'NOT LIKE',
                value: this.unquoteValue(notLikeMatch[2])
            };
        }

        // LIKE
        const likeMatch = cond.match(/^(.+?)\s+LIKE\s+([\s\S]+)$/i);
        if (likeMatch) {
            return {
                column: this.unquoteIdentifier(likeMatch[1], dbType),
                operator: 'LIKE',
                value: this.unquoteValue(likeMatch[2])
            };
        }

        // Standard comparison operators: !=, <=, >=, <>, <, >, =
        const compMatch = cond.match(/^(.+?)\s*(!=|<>|<=|>=|<|>|=)\s*([\s\S]+)$/);
        if (compMatch) {
            let op = compMatch[2].trim();
            if (op === '<>') op = '!=';
            return {
                column: this.unquoteIdentifier(compMatch[1], dbType),
                operator: op as FilterCondition['operator'],
                value: this.unquoteValue(compMatch[3])
            };
        }

        return null;
    }
}
