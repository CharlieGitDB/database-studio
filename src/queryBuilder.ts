import {
    QueryBuilderState,
    SelectColumn,
    FilterCondition,
    JoinClause,
    OrderByClause,
    AggregateFunction,
    FilterOperator
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
            parts.push(this.buildJoinClauses(state.joins, dbType));
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

    private static buildJoinClauses(joins: JoinClause[], dbType: string): string {
        return joins.map(join => {
            const joinTable = this.quoteIdentifier(join.table, dbType);
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
     * Parses a simple SELECT query back into builder state (basic implementation)
     * This is a simplified parser for common query patterns
     */
    static parseSQL(sql: string, schema?: string): QueryBuilderState | null {
        try {
            // Remove semicolon and trim
            sql = sql.trim().replace(/;$/, '');

            // Extract table name from FROM clause
            const fromMatch = sql.match(/FROM\s+(?:"?(\w+)"?\."?)?(\w+)/i);
            if (!fromMatch) {
                return null;
            }

            const table = fromMatch[2];
            const extractedSchema = fromMatch[1] || schema;

            const state: QueryBuilderState = {
                table,
                schema: extractedSchema,
                distinct: /SELECT\s+DISTINCT/i.test(sql),
                selectColumns: [],
                filters: [],
                joins: [],
                orderBy: [],
                groupBy: []
            };

            // Extract LIMIT
            const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
            if (limitMatch) {
                state.limit = parseInt(limitMatch[1]);
            }

            // Extract OFFSET
            const offsetMatch = sql.match(/OFFSET\s+(\d+)/i);
            if (offsetMatch) {
                state.offset = parseInt(offsetMatch[1]);
            }

            return state;
        } catch (error) {
            console.error('Error parsing SQL:', error);
            return null;
        }
    }
}
