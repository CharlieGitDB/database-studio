# Database Client GUI

A VS Code extension that provides a GUI for managing Redis, MySQL, PostgreSQL, and MongoDB databases with easy view, edit, and delete operations.

## Features

- **Multiple Database Support**: Connect to Redis, MySQL, PostgreSQL, and MongoDB
- **View Data**: Browse tables, collections, and keys with an intuitive interface
- **Edit Records**: Modify records directly from the GUI
- **Delete Records**: Remove records with confirmation dialogs
- **Connection Management**: Save and manage multiple database connections

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

1. **Add Connection**: Click the '+' icon in the Database Client view
2. **Connect**: Click the plug icon on a connection to connect
3. **View Data**: Click on a connection to see databases/tables, then click 'View Data' to browse
4. **Edit**: Click 'Edit' on any row in the data viewer
5. **Delete**: Click 'Delete' on any row to remove it

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
