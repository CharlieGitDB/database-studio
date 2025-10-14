# MongoDB UI Features

This extension now includes a comprehensive, MongoDB-specific user interface designed specifically for working with MongoDB databases.

## Features Overview

### 1. **Documents Tab** 📄
The main view for browsing and managing your MongoDB documents.

#### Features:
- **Insert Documents**: Click "➕ Insert Document" to add new documents with a JSON editor
- **View Documents**: Click the 👁️ icon to view a document in a read-only, formatted JSON view
- **Edit Documents**: Click the ✏️ icon to edit documents with full JSON support
- **Delete Documents**: Click the 🗑️ icon to remove documents (with confirmation)
- **Quick Filter**: Type in the filter box and press Enter to filter documents by any field
- **Export**: Export all displayed documents to a JSON file
- **Refresh**: Reload the collection data
- **Smart Cell Display**: JSON objects in cells are clickable to view in a formatted modal

#### Document Operations:
- All document editing uses a JSON editor with syntax highlighting
- Automatic JSON validation before saving
- The `_id` field is automatically handled and cannot be changed
- Complex nested objects and arrays are fully supported

### 2. **Visual Query Builder Tab** 🎨
Build queries visually through a step-by-step wizard interface - no coding required!

#### Features:
- **Step 1: Select Fields** - Choose which fields to include in results
  - Visual checkboxes for all fields
  - "Select All" and "Deselect All" quick actions
  - Live preview of selected fields
  - Leave all unchecked to return all fields

- **Step 2: Add Filters** - Build complex query conditions
  - Dynamic filter rows with field, operator, value, and type
  - Choose between AND/OR logic for combining conditions
  - Support for 10+ comparison operators
  - Real-time query preview
  - Add/remove filters with ease

- **Step 3: Options & Execute** - Configure and run your query
  - Sort options (field and order)
  - Limit results (1-1000 documents)
  - Skip documents for pagination
  - Final query preview showing all details
  - Execute or reset the wizard

#### Supported Operators:
- **Comparison**: `=` (equals), `!=` (not equals), `>`, `>=`, `<`, `<=`
- **Array**: `IN` (in array), `NOT IN` (not in array)
- **Pattern**: `REGEX` (pattern match)
- **Existence**: `EXISTS` (field exists)

#### Data Types:
- **String**: Text values
- **Number**: Numeric values (integers and floats)
- **Boolean**: true/false values
- **Array**: JSON arrays like `[1, 2, 3]`

#### Step Indicator:
- Visual progress indicator showing current step
- Completed steps marked with checkmark
- Navigate forward and backward through steps
- Reset wizard to start over

#### Example Workflow:
1. **Step 1**: Select fields `name`, `email`, `age`
2. **Step 2**: Add filter `age > 25` (AND) `status = active`
3. **Step 3**: Sort by `createdAt` descending, limit 50
4. **Execute**: Results shown in main table

### 3. **Advanced Query Builder Tab** 🔍
Execute MongoDB queries using native MongoDB query syntax (for advanced users).

#### Features:
- **JSON Query Editor**: Write queries using MongoDB's query syntax
- **Syntax Highlighting**: CodeMirror editor with JSON mode
- **Keyboard Shortcuts**: Press Ctrl+Enter to execute queries
- **Built-in Examples**: Quick reference for common query patterns

#### Query Examples:
```json
// Find by exact match
{"name": "John Doe"}

// Find with comparison operators
{"age": {"$gt": 25}}

// Find with logical operators
{"$or": [{"status": "active"}, {"priority": "high"}]}

// Find with regex
{"email": {"$regex": "@gmail\\.com$"}}

// Find nested fields
{"address.city": "New York"}
```

#### Supported Operators:
- Comparison: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`
- Logical: `$and`, `$or`, `$not`, `$nor`
- Element: `$exists`, `$type`
- Evaluation: `$regex`, `$text`, `$where`
- Array: `$all`, `$elemMatch`, `$size`

### 4. **Aggregation Pipeline Tab** 📊
Execute powerful aggregation pipelines for data analysis.

#### Features:
- **Pipeline Editor**: Define multi-stage aggregation pipelines
- **JSON Array Format**: Enter pipelines as JSON arrays
- **Syntax Highlighting**: Full JSON syntax support
- **Keyboard Shortcuts**: Ctrl+Enter to execute
- **Built-in Examples**: Common aggregation patterns

#### Aggregation Examples:
```json
// Group and count
[{"$group": {"_id": "$status", "count": {"$sum": 1}}}]

// Match and sort
[{"$match": {"active": true}}, {"$sort": {"createdAt": -1}}]

// Lookup (join collections)
[{
  "$lookup": {
    "from": "orders",
    "localField": "_id",
    "foreignField": "userId",
    "as": "userOrders"
  }
}]

// Project specific fields
[{"$project": {"name": 1, "email": 1, "age": 1}}]

// Complex multi-stage pipeline
[
  {"$match": {"status": "active"}},
  {"$group": {"_id": "$category", "total": {"$sum": "$amount"}}},
  {"$sort": {"total": -1}},
  {"$limit": 10}
]
```

#### Supported Stages:
- `$match`, `$group`, `$project`, `$sort`, `$limit`, `$skip`
- `$lookup`, `$unwind`, `$replaceRoot`, `$facet`
- `$bucket`, `$bucketAuto`, `$sortByCount`
- `$addFields`, `$count`, `$sample`

### 5. **Indexes Tab** 📇
Manage indexes for optimal query performance.

#### Features:
- **View Indexes**: See all indexes on the collection
- **Create Indexes**: Add new indexes with custom keys and options
- **Drop Indexes**: Remove indexes (except the default `_id` index)
- **Index Details**: View index keys and names

#### Creating Indexes:
1. Click "➕ Create Index"
2. Enter index keys as JSON:
   ```json
   {"email": 1}              // Single field, ascending
   {"email": 1, "name": -1}  // Compound index
   ```
3. Optionally add options:
   ```json
   {"unique": true, "name": "email_unique_idx"}
   {"sparse": true}
   {"background": true}
   ```

#### Index Options:
- `unique`: Ensure field values are unique
- `sparse`: Index only documents with the field
- `name`: Custom index name
- `background`: Build index in background
- `expireAfterSeconds`: TTL for automatic document deletion

## UI Enhancements

### Visual Design
- **Modern Interface**: Clean, intuitive design matching VS Code theme
- **Tabbed Navigation**: Easy switching between different functions
- **Responsive Layout**: Adapts to different window sizes
- **Syntax Highlighting**: All JSON editors use CodeMirror with Monokai theme

### User Experience
- **Real-time Statistics**: See document count and field count at a glance
- **Quick Actions**: Common operations accessible with single clicks
- **Confirmation Dialogs**: Prevents accidental deletions
- **Error Handling**: Clear error messages for invalid operations
- **Loading States**: Visual feedback during operations

### Data Display
- **Smart Table**: Automatically adjusts to document structure
- **Cell Expansion**: Click JSON cells to view formatted content
- **Horizontal Scrolling**: Handle wide documents gracefully
- **Hover Effects**: Visual feedback on interactive elements

## Keyboard Shortcuts

- **Ctrl+Enter** (Cmd+Enter on Mac): Execute query or aggregation
- **Enter** (in Quick Filter): Apply filter
- **Escape**: Close modals (when implemented)

## Technical Details

### Client Methods
The MongoDB client (`mongoClient.ts`) supports:
- `getCollections()`: List all collections
- `getCollectionData(name, limit)`: Fetch documents
- `insertDocument(collection, document)`: Insert new document
- `updateDocument(collection, id, updates)`: Update document
- `deleteDocument(collection, id)`: Delete document
- `executeQuery(collection, query)`: Run find query
- `aggregate(collection, pipeline)`: Run aggregation
- `getIndexes(collection)`: Get all indexes
- `createIndex(collection, keys, options)`: Create index
- `dropIndex(collection, name)`: Remove index
- `getDocumentById(collection, id)`: Fetch single document

### Data Flow
1. User performs action in webview
2. Message sent to VS Code extension via `vscode.postMessage()`
3. Extension processes request using MongoDB client
4. Results sent back to webview
5. UI updates with new data

### Error Handling
- JSON validation before sending to server
- Try-catch blocks for all operations
- User-friendly error messages
- Automatic rollback on failures

## Best Practices

1. **Use Indexes**: Create indexes for frequently queried fields
2. **Limit Results**: Queries return max 100 documents by default
3. **Test Queries**: Use Query Builder before bulk operations
4. **Backup Data**: Export important collections before major changes
5. **Validate JSON**: Use the syntax-highlighted editors to avoid errors

## Future Enhancements

Potential future additions:
- Schema validation
- Bulk import/export
- Query history
- Saved queries
- Collection statistics
- Performance insights
- Data visualization

## Troubleshooting

### Common Issues

**Problem**: Can't connect to MongoDB
**Solution**: Check connection string, ensure MongoDB is running, verify credentials

**Problem**: Queries not returning results
**Solution**: Check query syntax, verify collection has data, check filter criteria

**Problem**: Index creation fails
**Solution**: Ensure index keys are valid, check for duplicate values if using `unique`

**Problem**: JSON validation errors
**Solution**: Use an online JSON validator to check your JSON syntax

## Support

For issues or feature requests, please create an issue in the project repository.
