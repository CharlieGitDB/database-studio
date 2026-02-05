export type DatabaseType = 'redis' | 'mysql' | 'postgresql' | 'mongodb';

export interface ConnectionConfig {
    id: string;
    name: string;
    type: DatabaseType;
    host: string;
    port: number;
    username?: string;
    password?: string;
    database?: string;
    updateProtection?: boolean;
}

export interface RedisKey {
    key: string;
    type: string;
    ttl: number;
}

export interface TableSchema {
    name: string;
    type: string;
}

export interface QueryResult {
    columns: string[];
    rows: any[];
}

// Query Builder Types
export type AggregateFunction = 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'NONE';
export type FilterOperator = '=' | '!=' | '<' | '>' | '<=' | '>=' | 'LIKE' | 'NOT LIKE' | 'IN' | 'NOT IN' | 'IS NULL' | 'IS NOT NULL';
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
export type LogicalOperator = 'AND' | 'OR';
export type SortDirection = 'ASC' | 'DESC';

export interface ColumnInfo {
    name: string;
    type: string;
    nullable: boolean;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    referencedTable?: string;
    referencedColumn?: string;
}

export interface ConstraintInfo {
    name: string;
    type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK';
    columns: string[];
    definition?: string;
    referencedTable?: string;
    referencedColumns?: string[];
}

export interface IndexInfo {
    name: string;
    columns: string[];
    isUnique: boolean;
    isPrimary: boolean;
    type?: string;  // btree, hash, etc.
}

export interface RuleInfo {
    name: string;
    event: string;
    definition: string;
}

export interface TriggerInfo {
    name: string;
    event: string;
    timing: string;
    definition?: string;
}

export type MetadataFolderType = 'columns' | 'constraints' | 'indexes' | 'rules' | 'triggers';

export interface SelectColumn {
    column: string;
    alias?: string;
    aggregate: AggregateFunction;
}

export interface FilterCondition {
    column: string;
    operator: FilterOperator;
    value: string;
    logicalOperator?: LogicalOperator; // For combining with next condition
}

export interface JoinClause {
    table: string;
    type: JoinType;
    leftColumn: string;
    rightColumn: string;
}

export interface OrderByClause {
    column: string;
    direction: SortDirection;
    priority: number; // For multi-column sorting
}

export interface QueryBuilderState {
    table: string;
    schema?: string;
    distinct: boolean;
    selectColumns: SelectColumn[];
    filters: FilterCondition[];
    joins: JoinClause[];
    orderBy: OrderByClause[];
    limit?: number;
    offset?: number;
    groupBy: string[];
}

export interface SavedQuery {
    id: string;
    name: string;
    description?: string;
    state: QueryBuilderState;
    sql: string;
    createdAt: number;
    updatedAt: number;
}
