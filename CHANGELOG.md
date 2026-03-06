# Change Log

All notable changes to the "Database Studio by Reswob" extension will be documented in this file.


## [1.3.0] - 2026-03-06

### Added
- MySQL multi-database browsing — connections now list all user databases, with tables nested under each database
- Database-qualified queries for MySQL — SELECT, UPDATE, and DELETE statements use `database`.`table` syntax to prevent cross-database errors
- Sidebar connections grouped by database type (MongoDB, MySQL, PostgreSQL, Redis) with alphabetical sorting
- Full SQL parser for the query builder — parses SELECT columns (with aggregates and aliases), WHERE, JOINs, ORDER BY, GROUP BY, LIMIT, and OFFSET
- Bidirectional sync between SQL Editor and Query Builder tabs — edits in either tab are reflected when switching
- `parseSQL` webview message handler for backend SQL-to-builder-state conversion
- `getDatabases()` method on MySQL client that queries `INFORMATION_SCHEMA.SCHEMATA` and filters system databases
- MySQL `USE` statement issued before query execution when a database context is provided

### Changed
- Sidebar tree root level now shows type group nodes instead of flat connections; connection labels no longer include the database type suffix
- Query builder `parseSQL` now accepts a `dbType` parameter for dialect-aware identifier quoting
- `applyLoadedQuery` reuses shared `applyColumnsSelection` helper and syncs loaded SQL to the editor
- `updateBuilder` collapses all-columns-selected with no aggregates/aliases into `SELECT *`

### Fixed
- MySQL `getColumns`, `getConstraints`, `getIndexes`, and `getTriggers` now receive the database name for correct metadata lookups

## [1.1.3] - 2026-03-06

### Added
- JSON viewer modal for PostgreSQL and MySQL JSON/JSONB columns with syntax-highlighted pretty-print, click-to-expand cells, and copy-to-clipboard
- Theme-matched syntax highlighting for CodeMirror editors — reads the active VS Code color theme's token colors and applies them via CSS custom properties (replaces hardcoded Monokai theme)
- Loading bar with spinner shown during query execution, refresh, and aggregation operations
- Column type detection (`json`/`other`) in PostgreSQL and MySQL clients, surfaced via new `columnTypes` field on `QueryResult`
- Redis sorted set (`zset`) write support
- Jest test infrastructure with `ts-jest`, vscode mock, and comprehensive unit tests across all clients, providers, and message handlers
- `CONTRIBUTING.md` guide

### Fixed
- MongoDB ObjectId validation — invalid IDs now throw a clear error instead of crashing
- MongoDB query execution passes collection name and database name correctly
- MongoDB document edit/delete uses `_id` column index lookup instead of assuming column 0
- MySQL table listing uses `INFORMATION_SCHEMA.TABLES` with parameterized query instead of `SHOW TABLES`
- MySQL table/column names properly backtick-quoted in default queries
- PostgreSQL schema name escaped in `SET search_path` to prevent SQL injection
- Query builder JOIN clauses now include schema prefix for PostgreSQL
- Query builder `parseSQL` handles quoted and backtick-quoted identifiers in FROM clauses
- CTE (`WITH`) read-only detection checks for DML keywords inside the body instead of blindly allowing all CTEs
- Tree data provider properly awaits async folder-item methods (columns, constraints, indexes, rules, triggers)

### Changed
- `create-vsix` script now runs tests and bumps patch version before packaging
- Extension marketplace categories updated to include "Data Science" and "Visualization"
- Removed stale setup and testing docs (`GIT_SETUP_REVERT.md`, `TEST_MONGODB_WEBVIEW.md`)

## [1.1.2] - 2026-03-05

### Fixed
- Fixed connection form and MongoDB webview panels failing to open in packaged extension (ENOENT error on webview HTML/JS assets)

## [1.1.1] - 2026-03-05

### Fixed
- Redis data preview no longer shows "Table listing not supported for this database type" error
- Defensive handling for unsupported table/column introspection in non-SQL databases

## [1.1.0] - 2026-03-05


### Added
- Context-aware SQL autocomplete for PostgreSQL and MySQL query editors
- Suggestions for schemas, tables (from all schemas), and columns based on query context
- Dot-access completions (schema.table.column) and alias resolution
- Bulk schema introspection for fast metadata loading (single INFORMATION_SCHEMA query)
- Loading indicator and error feedback for schema info in the query editor
- New connection creation and edit experience using a webview form panel (replaces input box flow)


## [1.0.6] - 2026-02-04

### Added
- Expandable table nodes in sidebar for PostgreSQL and MySQL databases
- Tables now show metadata folders: Columns, Constraints, Indexes, Rules (PostgreSQL only), and Triggers
- Column details display type, nullability, and key information (PK, FK with references)
- Constraint items show type-specific icons (key for PK, references for FK, shield for UNIQUE, check for CHECK)
- Index items display index type (btree, hash), uniqueness, and primary status
- Trigger items show timing (BEFORE/AFTER) and event type (INSERT/UPDATE/DELETE)

## [1.0.5] - 2026-01-19

### Fixed
- Query error handling now displays errors inline within the results container instead of replacing the entire UI
- Users can now see their query and error messages simultaneously, allowing immediate fixes and retries
- Query editor and UI context are preserved when query execution fails

## [1.0.4] - 2025-11-05

### Added
- Support for multiple database viewer tabs open simultaneously
- Each viewer tab now displays the resource name in its title for easy identification

### Changed
- Removed panel reuse logic to allow independent database viewer instances with different queries

## [1.0.3] - 2025-11-05

### Improved
- Further increased sidebar icon size to match VS Code standard icons for optimal visibility

## [1.0.2] - 2025-11-04

### Improved
- Increased sidebar icon size for better visibility and consistency with other VS Code icons
- Applied consistent UX improvements to SQL webviews (MySQL, PostgreSQL)
- Standardized top padding to 5px across all webview types for efficient screen space usage

### Fixed
- Renamed `prod-package` script to `create-vsix` for clarity
- Fixed syntax error in package.json scripts section

## [1.0.1] - 2025-11-03

### Fixed
- Fixed sidebar icon appearing cut off in VS Code activity bar
- Added extension icon for marketplace and extensions search
- Optimized package size by excluding node_modules from bundle

### Improved
- Webview header now displays connection name alongside table/collection name for better context
- Reduced excessive whitespace at the top of webview for more efficient use of screen space
- Updated sidebar icon to include "R" branding to match marketplace icon

## [1.0.0] - 2025-11-03

### Initial Release

#### Features
- **Multi-Database Support**: Connect to Redis, MySQL, PostgreSQL, and MongoDB databases
- **Connection Management**:
  - Add, edit, and delete database connections
  - Connect/disconnect from databases with one click
  - Persistent connection storage
- **Data Viewing**: Browse and view data from tables, collections, and keys
- **Query Builder**: Visual query builder for constructing database queries
- **Query Management**: Save and manage frequently used queries
- **Record Operations**: Edit and delete records directly from the interface
- **Update Protection**: Safety warnings for databases with update protection enabled
- **Activity Bar Integration**: Dedicated Database Studio icon in VS Code activity bar
- **Connection Explorer**: Tree view showing all connections and their structure

#### Technical
- Built with TypeScript
- Optimized bundle size using esbuild
- Support for VS Code 1.85.0 and above
- GPL-3.0 licensed
