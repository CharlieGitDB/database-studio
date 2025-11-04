# Database Studio by Reswob

A professional VS Code extension that provides a comprehensive database management studio for Redis, MySQL, PostgreSQL, and MongoDB with visual query builder and intuitive data management.

## Features

- **Multiple Database Support**: Connect to Redis, MySQL, PostgreSQL, and MongoDB
- **View Data**: Browse tables, collections, and keys with an intuitive interface
- **Edit Records**: Modify records directly from the GUI
- **Delete Records**: Remove records with confirmation dialogs
- **Connection Management**: Save and manage multiple database connections
- **SQL Query Builder GUI** (NEW!): Visual query builder for MySQL and PostgreSQL
  - Column selection with aggregate functions (COUNT, SUM, AVG, MIN, MAX)
  - WHERE conditions with multiple operators (=, !=, <, >, LIKE, IN, IS NULL, etc.)
  - JOIN support with automatic foreign key detection
  - ORDER BY with multi-column sorting
  - LIMIT and OFFSET controls
  - Real-time SQL preview
  - Save and load query templates

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Compile the extension:
   ```bash
   npm run compile
   ```

3. Press F5 to open a new VS Code window with the extension loaded

## Usage

### Basic Database Operations

1. **Add Connection**: Click the '+' icon in the Database Studio view
2. **Connect**: Click the plug icon on a connection to connect
3. **View Data**: Click on a connection to see databases/tables, then click 'View Data' to browse
4. **Edit**: Click 'Edit' on any row in the data viewer
5. **Delete**: Click 'Delete' on any row to remove it

### Using the Query Builder (MySQL & PostgreSQL)

1. **Open a Table**: Click 'View Data' on any table in the tree view
2. **Switch to Query Builder**: Click the "Query Builder" tab at the top
3. **Select Columns**:
   - Check the columns you want to include in your query
   - Optionally add aggregate functions (COUNT, SUM, AVG, etc.)
   - Add column aliases as needed
4. **Add Filters (WHERE)**:
   - Click "+ Add Filter" to add conditions
   - Select column, operator, and value
   - Chain multiple conditions with AND/OR
5. **Add JOINs**:
   - Click "+ Add Join" to join related tables
   - Foreign key relationships are automatically detected and suggested
6. **Sort Results (ORDER BY)**:
   - Click "+ Add Sort" to specify sorting
   - Support for multi-column sorting with priority ordering
7. **Set LIMIT/OFFSET**:
   - Control the number of results returned
   - Use OFFSET for pagination
8. **Preview & Execute**:
   - View the generated SQL in real-time
   - Click "▶ Run Query" to execute
   - Click "📋 Copy SQL" to copy the query to clipboard
9. **Save Queries**:
   - Click "💾 Save Current" to save your query as a template
   - Load saved queries anytime for reuse

## Supported Databases

- **Redis**: View and manage keys, supports all data types
- **MySQL**: Browse tables and manage records
- **PostgreSQL**: Browse tables and manage records
- **MongoDB**: Browse collections and manage documents

## Development

- Run `npm run watch` for continuous compilation
- Press F5 to launch the extension in debug mode
- Use the VS Code Extension Development Host to test

## Requirements

- VS Code 1.85.0 or higher
- Node.js 20.x or higher

## License

MIT
