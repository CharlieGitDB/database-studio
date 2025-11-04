# Change Log

All notable changes to the "Database Studio by Reswob" extension will be documented in this file.

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
