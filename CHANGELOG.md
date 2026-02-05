# Change Log

All notable changes to the "Database Studio by Reswob" extension will be documented in this file.

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
