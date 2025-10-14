# Visual Query Builder Guide

The Visual Query Builder is a no-code interface for building MongoDB queries through a step-by-step wizard. Perfect for users who want to query MongoDB without learning the query syntax!

## Overview

The Visual Query Builder consists of 3 easy steps:
1. **Select Fields** - Choose what data to return
2. **Add Filters** - Specify conditions to match documents
3. **Options & Execute** - Set sort, limit, and run the query

## Step-by-Step Guide

### Step 1: Select Fields

This step lets you choose which fields should be included in your query results.

**How it works:**
- All available fields from your collection are displayed as checkboxes
- Check the fields you want to see in the results
- Leave all unchecked to return ALL fields (MongoDB's default behavior)
- Use "Select All" or "Deselect All" for quick selection
- A preview shows your currently selected fields

**Example:**
```
Selected Fields:
✓ _id
✓ name
✓ email
✓ createdAt

Result: Only these 4 fields will be returned
```

**Navigation:**
- Click "Next: Add Filters →" to proceed to Step 2

---

### Step 2: Add Filters

Build query conditions to filter which documents match your criteria.

**How it works:**
- Click "➕ Add Filter" to create a new filter row
- Each filter has 4 components:
  1. **Field**: Choose which field to filter
  2. **Operator**: Select comparison operator
  3. **Value**: Enter the value to compare against
  4. **Type**: Specify the data type

**Available Operators:**

| Operator | Label | Description | Example |
|----------|-------|-------------|---------|
| `$eq` | = (equals) | Exact match | `status = "active"` |
| `$ne` | != (not equals) | Not equal | `status != "deleted"` |
| `$gt` | > (greater than) | Greater than | `age > 18` |
| `$gte` | >= (greater or equal) | Greater than or equal | `price >= 100` |
| `$lt` | < (less than) | Less than | `stock < 10` |
| `$lte` | <= (less or equal) | Less than or equal | `quantity <= 5` |
| `$in` | IN (in array) | Value in list | `category IN ["A", "B"]` |
| `$nin` | NOT IN (not in array) | Value not in list | `status NOT IN ["draft"]` |
| `$regex` | REGEX (pattern match) | Pattern matching | `email REGEX "@gmail\\.com$"` |
| `$exists` | EXISTS (field exists) | Field presence | `phone EXISTS true` |

**Data Types:**

- **String**: Text values (e.g., "John Doe", "active")
- **Number**: Numeric values (e.g., 25, 99.99, -10)
- **Boolean**: true or false
- **Array**: JSON array format (e.g., `[1, 2, 3]` or `["a", "b", "c"]`)

**Combining Multiple Filters:**

Use the **"Combine conditions with"** dropdown to choose how filters are combined:
- **AND**: ALL conditions must match (default)
- **OR**: ANY condition can match

**Example Filters:**

```
Filter 1: age > 25 (Number)
Filter 2: status = "active" (String)
Logic: AND

MongoDB Query: { "$and": [{ "age": { "$gt": 25 } }, { "status": "active" }] }
```

**Query Preview:**
- A live preview shows the generated MongoDB query
- Updates automatically as you add/modify filters

**Navigation:**
- Click "← Back" to return to Step 1
- Click "Next: Options & Execute →" to proceed to Step 3
- Use "Clear All Filters" to remove all filters at once

---

### Step 3: Options & Execute

Configure additional query options and execute your query.

**Sort Options:**
- **Sort By**: Choose which field to sort by
- **Sort Order**:
  - Ascending (1): A → Z, 0 → 9
  - Descending (-1): Z → A, 9 → 0

**Pagination:**
- **Limit Results**: Maximum number of documents to return (1-1000)
  - Default: 100 documents
  - Useful for large collections
- **Skip Documents**: Number of documents to skip
  - Default: 0
  - Useful for pagination (e.g., skip 100, limit 100 for page 2)

**Final Query Preview:**

Shows a comprehensive summary of your entire query:

1. **Filter**: The MongoDB query conditions
2. **Projection**: Fields to return (or "All fields")
3. **Sort**: Sort specification (or "None")
4. **Limit**: Number of documents to return

**Example:**
```
Filter: { "age": { "$gt": 25 }, "status": "active" }
Projection: { "_id": 1, "name": 1, "email": 1 }
Sort: { "createdAt": -1 }
Limit: 50
```

**Execution:**
- Click **"▶ Execute Query"** to run your query
- Results appear in the main documents table
- Click **"🔄 Reset All"** to clear everything and start over

**Navigation:**
- Click "← Back" to return to Step 2
- Click "▶ Execute Query" to run the query
- Click "🔄 Reset All" to reset the entire wizard

---

## Real-World Examples

### Example 1: Find Active Users

**Goal**: Find all active users created in the last 30 days

**Step 1**: Select Fields
- ✓ name
- ✓ email
- ✓ status
- ✓ createdAt

**Step 2**: Add Filters
- Filter 1: `status = "active"` (String)
- Filter 2: `createdAt > "2024-12-13"` (String)
- Logic: AND

**Step 3**: Options
- Sort By: createdAt
- Sort Order: Descending (-1)
- Limit: 100

**Result**: Shows 100 most recent active users with only selected fields

---

### Example 2: Find Products in Stock

**Goal**: Find all products with stock > 0 and price < $100

**Step 1**: Select Fields
- ✓ productName
- ✓ price
- ✓ stock
- ✓ category

**Step 2**: Add Filters
- Filter 1: `stock > 0` (Number)
- Filter 2: `price < 100` (Number)
- Logic: AND

**Step 3**: Options
- Sort By: price
- Sort Order: Ascending (1)
- Limit: 50

**Result**: Shows 50 cheapest in-stock products under $100

---

### Example 3: Search by Category

**Goal**: Find items in specific categories

**Step 1**: Select Fields
- (leave all unchecked for all fields)

**Step 2**: Add Filters
- Filter 1: `category IN ["Electronics", "Computers"]` (Array)
  - Note: Enter as JSON array: `["Electronics", "Computers"]`
- Logic: N/A (single filter)

**Step 3**: Options
- Sort By: (none)
- Limit: 100

**Result**: Shows all documents where category is either "Electronics" or "Computers"

---

### Example 4: Find Documents with Optional Fields

**Goal**: Find all users who have provided a phone number

**Step 1**: Select Fields
- ✓ name
- ✓ email
- ✓ phone

**Step 2**: Add Filters
- Filter 1: `phone EXISTS true` (Boolean)
- Logic: N/A

**Step 3**: Options
- Sort By: name
- Sort Order: Ascending (1)
- Limit: 100

**Result**: Shows users who have the "phone" field, sorted alphabetically

---

## Tips & Best Practices

### For Beginners:
1. **Start Simple**: Begin with just 1-2 filters
2. **Use Default Types**: Start with String type, adjust if needed
3. **Check the Preview**: Always review the query preview before executing
4. **Limit Results**: Keep the limit reasonable (50-100) for faster queries

### For Intermediate Users:
1. **Combine Filters**: Use AND/OR logic for complex conditions
2. **Use Indexes**: If queries are slow, create indexes on filtered fields
3. **Field Selection**: Only select fields you need for better performance
4. **Pagination**: Use skip/limit for browsing large result sets

### For Advanced Users:
1. **Copy the Query**: Use the query preview to learn MongoDB syntax
2. **Switch to Advanced**: Complex queries? Use the "Advanced Query" tab
3. **Aggregation**: For grouping/calculations, use the "Aggregation" tab
4. **Regex Patterns**: Use REGEX for flexible text searching

---

## Common Patterns

### Pattern 1: Search and Sort
```
Filters: Search term in name field
Sort: By relevance or date
Limit: 20-50 results
```

### Pattern 2: Range Query
```
Filters:
  - Field >= minimum value
  - Field <= maximum value
Logic: AND
```

### Pattern 3: Exclude Items
```
Filters:
  - status != "deleted"
  - status != "archived"
Logic: AND
```

### Pattern 4: Category + Price Filter
```
Filters:
  - category IN ["Cat1", "Cat2"]
  - price < 100
Logic: AND
```

---

## Troubleshooting

### No Results Found
- **Check filter values**: Ensure values match your data exactly
- **Check data types**: Numbers should use Number type, not String
- **Check operators**: Using `=` when you meant `>`?
- **Check logic**: Should filters be AND or OR?

### Query Too Slow
- **Add indexes**: Create indexes on filtered fields (see Indexes tab)
- **Reduce limit**: Lower the document limit
- **Select fewer fields**: Only return fields you need
- **Simplify filters**: Remove unnecessary conditions

### Array Values Not Working
- **Check JSON format**: Arrays must be valid JSON: `[1, 2, 3]`
- **Check quotes**: Strings in arrays need quotes: `["a", "b"]`
- **No spaces**: Avoid extra spaces in arrays

### Unexpected Results
- **Review query preview**: Check the generated MongoDB query
- **Test in Advanced tab**: Copy query to Advanced Query tab for testing
- **Check data**: View actual documents to understand data structure

---

## Keyboard Shortcuts

- **Step Navigation**: Use buttons to move between steps (no shortcuts yet)
- **Add Filter**: Click "➕ Add Filter" button
- **Execute**: Click "▶ Execute Query" button

---

## Under the Hood

The Visual Query Builder converts your selections into MongoDB aggregation pipelines:

1. **$match**: Filters (Step 2)
2. **$sort**: Sort options (Step 3)
3. **$skip**: Skip documents (Step 3)
4. **$limit**: Limit results (Step 3)
5. **$project**: Field selection (Step 1)

This approach provides maximum flexibility while maintaining a simple UI.

---

## Next Steps

After mastering the Visual Query Builder:

1. **Advanced Query Tab**: Write MongoDB queries directly in JSON
2. **Aggregation Tab**: Learn aggregation pipelines for complex analysis
3. **Indexes Tab**: Create indexes to speed up your queries

Happy querying! 🚀
