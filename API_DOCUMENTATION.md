# Library-RAG API Documentation

## Overview

The Library-RAG backend is a REST API built with **NestJS** that manages a comprehensive library system with RAG (Retrieval-Augmented Generation) capabilities. The API provides endpoints for authentication, book catalog management, member circulation, document management, and AI-powered chat with library documents.

**Base URL:** `http://localhost:4000/api/v1`

**Interactive Docs:** `http://localhost:4000/api/docs` (Swagger UI)

---

## Authentication

The API uses **JWT (JSON Web Tokens)** for authentication. Tokens are issued on login and refreshed as needed.

### Authentication Header
```
Authorization: Bearer <accessToken>
```

**Note:** Auth endpoints (`login`, `register`) do not require authentication. All other endpoints require a valid JWT token in the `Authorization` header.

---

## Common Response Format

### Paginated List Response
Most list endpoints return a paginated envelope:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 10,
  "pageCount": 0
}
```

### Error Response
```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

---

## Endpoints

### Authentication

#### `POST /auth/login`
Login to get a JWT access token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin"
  }
}
```

**Errors:**
- `401 Unauthorized` - Invalid credentials

---

#### `POST /auth/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "member",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `400 Bad Request` - Email already taken or validation failed

---

#### `POST /auth/change-password`
Change the authenticated user's password.

**Requires:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword456"
}
```

**Response (200 OK):**
```json
{
  "message": "Password updated successfully"
}
```

**Errors:**
- `401 Unauthorized` - Invalid current password or not authenticated
- `403 Forbidden` - Demo accounts cannot change their password

---

#### `PATCH /auth/profile`
Update the authenticated user's profile.

**Requires:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Jane Doe",
  "phone": "+1-234-567-8900"
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "Jane Doe",
  "phone": "+1-234-567-8900",
  "updatedAt": "2024-01-15T11:00:00Z"
}
```

**Errors:**
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Demo accounts cannot modify their profile

---

### Books

#### `GET /books`
List all books with pagination, filtering, and search.

**Requires:** `Authorization: Bearer <token>`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 10 | Items per page |
| `search` | string | - | Search in title, author, ISBN |
| `sortBy` | string | `createdAt` | Field to sort by (`title`, `author`, `createdAt`) |
| `sortDir` | string | `asc` | Sort direction (`asc`, `desc`) |
| `categoryId` | string | - | Filter by category ID |
| `shelfSlotId` | string | - | Filter by shelf slot location |
| `status` | string | - | Filter by status (`available`, `issued`, `reserved`) |

**Example Request:**
```
GET /books?page=1&pageSize=20&search=fiction&categoryId=uuid&sortBy=title&sortDir=asc
```

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "The Great Gatsby",
      "isbn": "978-0-7432-7356-5",
      "author": {
        "id": "uuid",
        "name": "F. Scott Fitzgerald"
      },
      "category": {
        "id": "uuid",
        "name": "Fiction"
      },
      "publisher": {
        "id": "uuid",
        "name": "Scribner"
      },
      "quantity": 5,
      "available": 3,
      "description": "A classic American novel",
      "shelfSlot": {
        "id": "uuid",
        "label": "A-1-2"
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 20,
  "pageCount": 8
}
```

---

#### `GET /books/:id`
Get a single book by ID.

**Requires:** `Authorization: Bearer <token>`

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Book UUID |

**Response (200 OK):**
```json
{
  "id": "uuid",
  "title": "The Great Gatsby",
  "isbn": "978-0-7432-7356-5",
  "author": { "id": "uuid", "name": "F. Scott Fitzgerald" },
  "category": { "id": "uuid", "name": "Fiction" },
  "publisher": { "id": "uuid", "name": "Scribner" },
  "quantity": 5,
  "available": 3,
  "description": "A classic American novel",
  "shelfSlot": { "id": "uuid", "label": "A-1-2" },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `404 Not Found` - Book not found

---

#### `GET /books/:id/borrow-history`
Get borrow history for a book.

**Requires:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "member": {
      "id": "uuid",
      "name": "Alice Johnson"
    },
    "issuedAt": "2024-01-10T10:00:00Z",
    "returnedAt": "2024-01-15T14:00:00Z",
    "dueAt": "2024-01-20T23:59:59Z",
    "status": "returned",
    "renewalCount": 1
  }
]
```

---

#### `POST /books`
Create a new book.

**Requires:** `Authorization: Bearer <token>` + `Role: admin | librarian`

**Request Body:**
```json
{
  "title": "The Great Gatsby",
  "isbn": "978-0-7432-7356-5",
  "authorId": "uuid",
  "categoryId": "uuid",
  "publisherId": "uuid",
  "quantity": 5,
  "description": "A classic American novel",
  "shelfSlotId": "uuid"
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "title": "The Great Gatsby",
  "isbn": "978-0-7432-7356-5",
  "author": { "id": "uuid", "name": "F. Scott Fitzgerald" },
  "category": { "id": "uuid", "name": "Fiction" },
  "publisher": { "id": "uuid", "name": "Scribner" },
  "quantity": 5,
  "available": 5,
  "description": "A classic American novel",
  "shelfSlot": { "id": "uuid", "label": "A-1-2" },
  "createdAt": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `400 Bad Request` - Missing required fields or validation failed
- `403 Forbidden` - Insufficient permissions

---

#### `PUT /books/:id`
Update a book.

**Requires:** `Authorization: Bearer <token>` + `Role: admin | librarian`

**Request Body:** (all fields optional)
```json
{
  "title": "The Great Gatsby (Revised)",
  "quantity": 10,
  "description": "Updated description",
  "shelfSlotId": "uuid"
}
```

**Response (200 OK):**
Updated book object

**Errors:**
- `404 Not Found` - Book not found
- `403 Forbidden` - Insufficient permissions

---

#### `DELETE /books/:id`
Delete a book.

**Requires:** `Authorization: Bearer <token>` + `Role: admin | librarian`

**Response (200 OK):**
```json
{
  "message": "Book deleted successfully"
}
```

**Errors:**
- `404 Not Found` - Book not found
- `403 Forbidden` - Insufficient permissions

---

#### `GET /books/shelf-slots`
List all available shelf slots.

**Requires:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "label": "A-1-1",
    "section": "A",
    "row": 1,
    "column": 1,
    "capacity": 50,
    "currentCount": 42
  }
]
```

---

#### `POST /books/shelf-slots`
Create a new shelf slot.

**Requires:** `Authorization: Bearer <token>` + `Role: admin | librarian`

**Request Body:**
```json
{
  "label": "A-1-1",
  "section": "A",
  "row": 1,
  "column": 1,
  "capacity": 50
}
```

**Response (201 Created):**
Shelf slot object

---

#### `PUT /books/shelf-slots/:id`
Update a shelf slot.

**Requires:** `Authorization: Bearer <token>` + `Role: admin | librarian`

**Response (200 OK):**
Updated shelf slot object

---

#### `DELETE /books/shelf-slots/:id`
Delete a shelf slot.

**Requires:** `Authorization: Bearer <token>` + `Role: admin | librarian`

**Response (200 OK):**
```json
{
  "message": "Shelf slot deleted successfully"
}
```

---

### Members

#### `GET /members/plan-constraints`
Get membership plan constraints for all available plans.

**Requires:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "basic": {
    "maxBooks": 3,
    "borrowPeriodDays": 14,
    "maxRenewals": 2,
    "fine": 0.50
  },
  "standard": {
    "maxBooks": 5,
    "borrowPeriodDays": 21,
    "maxRenewals": 3,
    "fine": 0.25
  },
  "premium": {
    "maxBooks": 10,
    "borrowPeriodDays": 30,
    "maxRenewals": 5,
    "fine": 0
  }
}
```

---

#### `GET /members`
List all members with pagination, filtering, and search.

**Requires:** `Authorization: Bearer <token>` + `Role: admin | librarian`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 10 | Items per page |
| `search` | string | - | Search in name, email, phone, memberID |
| `sortBy` | string | `createdAt` | Field to sort by |
| `sortDir` | string | `asc` | Sort direction |
| `status` | string | - | Filter by status (`active`, `suspended`, `inactive`) |
| `plan` | string | - | Filter by membership plan |

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "uuid",
      "memberId": "LIB-0001",
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "phone": "+1-234-567-8900",
      "plan": "standard",
      "status": "active",
      "totalBorrows": 12,
      "currentBorrows": 2,
      "totalFines": 0,
      "memberSince": "2024-01-01T00:00:00Z",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "pageSize": 10,
  "pageCount": 5
}
```

---

#### `GET /members/:id`
Get a single member by ID.

**Requires:** `Authorization: Bearer <token>`

**Response (200 OK):**
Member object (see list response for structure)

**Errors:**
- `404 Not Found` - Member not found

---

#### `GET /members/:id/borrow-history`
Get borrow history for a member.

**Requires:** `Authorization: Bearer <token>` + `Role: admin | librarian`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number |
| `pageSize` | number | Items per page |

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "uuid",
      "book": {
        "id": "uuid",
        "title": "The Great Gatsby",
        "author": "F. Scott Fitzgerald"
      },
      "issuedAt": "2024-01-10T10:00:00Z",
      "returnedAt": "2024-01-15T14:00:00Z",
      "dueAt": "2024-01-20T23:59:59Z",
      "status": "returned",
      "renewalCount": 1
    }
  ],
  "total": 12,
  "page": 1,
  "pageSize": 10,
  "pageCount": 2
}
```

---

#### `GET /members/:id/fine-history`
Get fine history for a member.

**Requires:** `Authorization: Bearer <token>` + `Role: admin | librarian`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number |
| `pageSize` | number | Items per page |

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "uuid",
      "borrow": {
        "id": "uuid",
        "book": { "title": "The Great Gatsby" },
        "dueAt": "2024-01-20T23:59:59Z",
        "returnedAt": "2024-01-25T10:00:00Z"
      },
      "amount": 2.50,
      "reason": "overdue",
      "status": "pending",
      "createdAt": "2024-01-25T10:00:00Z",
      "settledAt": null
    }
  ],
  "total": 3,
  "page": 1,
  "pageSize": 10,
  "pageCount": 1
}
```

---

#### `POST /members`
Register a new member.

**Requires:** `Authorization: Bearer <token>` + `Role: admin | librarian`

**Request Body:**
```json
{
  "name": "Alice Johnson",
  "email": "alice@example.com",
  "phone": "+1-234-567-8900",
  "plan": "standard"
}
```

**Response (201 Created):**
Member object

**Errors:**
- `400 Bad Request` - Email already exists or validation failed
- `403 Forbidden` - Insufficient permissions

---

#### `PUT /members/:id`
Update a member.

**Requires:** `Authorization: Bearer <token>` + `Role: admin | librarian`

**Request Body:** (all fields optional)
```json
{
  "name": "Alice Johnson",
  "phone": "+1-234-567-8901",
  "plan": "premium",
  "status": "active"
}
```

**Response (200 OK):**
Updated member object

---

#### `DELETE /members/:id`
Delete a member.

**Requires:** `Authorization: Bearer <token>` + `Role: admin | librarian`

**Response (200 OK):**
```json
{
  "message": "Member deleted successfully"
}
```

---

### Circulation (Borrows & Fines)

#### `GET /borrows`
List all borrow records.

**Requires:** `Authorization: Bearer <token>` + `Role: admin | librarian`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number |
| `pageSize` | number | Items per page |
| `status` | string | Filter by status (`issued`, `returned`, `overdue`) |
| `memberId` | string | Filter by member ID |
| `bookId` | string | Filter by book ID |

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "uuid",
      "book": {
        "id": "uuid",
        "title": "The Great Gatsby"
      },
      "member": {
        "id": "uuid",
        "name": "Alice Johnson"
      },
      "issuedAt": "2024-01-10T10:00:00Z",
      "dueAt": "2024-01-20T23:59:59Z",
      "returnedAt": null,
      "status": "issued",
      "renewalCount": 0
    }
  ],
  "total": 45,
  "page": 1,
  "pageSize": 10,
  "pageCount": 5
}
```

---

#### `POST /borrows`
Issue a book to a member.

**Requires:** `Authorization: Bearer <token>` + `Role: admin | librarian`

**Request Body:**
```json
{
  "memberId": "uuid",
  "bookId": "uuid"
}
```

**Response (201 Created):**
Borrow object

**Errors:**
- `400 Bad Request` - Book not available or member exceeded borrow limit
- `404 Not Found` - Member or book not found

---

#### `PATCH /borrows/:id`
Edit a borrow record.

**Requires:** `Authorization: Bearer <token>` + `Role: admin | librarian`

**Request Body:**
```json
{
  "dueAt": "2024-01-25T23:59:59Z"
}
```

**Response (200 OK):**
Updated borrow object

---

#### `POST /borrows/:id/return`
Return a borrowed book.

**Requires:** `Authorization: Bearer <token>` + `Role: admin | librarian`

**Response (200 OK):**
```json
{
  "id": "uuid",
  "status": "returned",
  "returnedAt": "2024-01-15T14:00:00Z",
  "fineAmount": 0,
  "message": "Book returned successfully"
}
```

**Errors:**
- `404 Not Found` - Borrow record not found
- `400 Bad Request` - Book already returned

---

#### `POST /borrows/:id/renew`
Renew a borrow (max 2 times by default).

**Requires:** `Authorization: Bearer <token>` + `Role: admin | librarian`

**Response (200 OK):**
```json
{
  "id": "uuid",
  "dueAt": "2024-02-15T23:59:59Z",
  "renewalCount": 1,
  "message": "Borrow renewed successfully"
}
```

**Errors:**
- `400 Bad Request` - Max renewals exceeded or book overdue

---

### Documents & RAG

#### `GET /documents`
List all uploaded documents.

**Requires:** `Authorization: Bearer <token>`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number |
| `pageSize` | number | Items per page |
| `search` | string | Search in document name |

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "library-policy.pdf",
      "mimeType": "application/pdf",
      "size": 1024000,
      "status": "indexed",
      "chunkCount": 45,
      "uploadedBy": {
        "id": "uuid",
        "name": "Admin User"
      },
      "uploadedAt": "2024-01-15T10:30:00Z",
      "indexedAt": "2024-01-15T10:35:00Z"
    }
  ],
  "total": 12,
  "page": 1,
  "pageSize": 10,
  "pageCount": 2
}
```

---

#### `GET /documents/:id`
Get document details.

**Requires:** `Authorization: Bearer <token>`

**Response (200 OK):**
Document object (see list response)

**Errors:**
- `404 Not Found` - Document not found

---

#### `POST /documents`
Upload a document (PDF, DOCX, TXT, Image).

**Requires:** `Authorization: Bearer <token>` + `Role: admin | librarian`

**Content-Type:** `multipart/form-data`

**Form Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `file` | file | Document file (max 50MB) |

**Supported File Types:**
- `application/pdf` - PDF files
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` - DOCX files
- `text/plain` - TXT files
- `image/jpeg`, `image/png`, `image/gif` - Image files

**Response (201 Created):**
```json
{
  "id": "uuid",
  "name": "library-policy.pdf",
  "mimeType": "application/pdf",
  "size": 1024000,
  "status": "processing",
  "uploadedBy": {
    "id": "uuid",
    "name": "Admin User"
  },
  "uploadedAt": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `400 Bad Request` - Unsupported file type or file too large
- `403 Forbidden` - Insufficient permissions

---

#### `DELETE /documents/:id`
Delete a document and its vector embeddings.

**Requires:** `Authorization: Bearer <token>` + `Role: admin | librarian`

**Response (200 OK):**
```json
{
  "message": "Document deleted successfully"
}
```

**Errors:**
- `404 Not Found` - Document not found
- `403 Forbidden` - Insufficient permissions

---

### RAG Chat

#### `GET /rag/conversations`
Get all conversations for the current user.

**Requires:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "title": "Library Policy Questions",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T15:30:00Z",
    "messageCount": 8
  }
]
```

---

#### `POST /rag/conversations`
Create a new conversation.

**Requires:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "Library Policy Questions"
}
```

**Response (201 Created):**
Conversation object (see list response)

---

#### `GET /rag/conversations/:id`
Get a specific conversation with all messages.

**Requires:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "id": "uuid",
  "title": "Library Policy Questions",
  "createdAt": "2024-01-15T10:00:00Z",
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "What is the maximum borrowing period?",
      "createdAt": "2024-01-15T10:05:00Z"
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content": "The maximum borrowing period is...",
      "createdAt": "2024-01-15T10:05:30Z"
    }
  ]
}
```

---

#### `DELETE /rag/conversations/:id`
Delete a conversation.

**Requires:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "message": "Conversation deleted successfully"
}
```

---

#### `POST /rag/chat`
Chat with the AI using indexed library documents as context.

**Requires:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "question": "What is the maximum borrowing period for premium members?",
  "history": [
    {
      "role": "user",
      "content": "Tell me about membership plans"
    },
    {
      "role": "assistant",
      "content": "We have three membership plans..."
    }
  ],
  "conversationId": "uuid"
}
```

**Response (200 OK):**
```json
{
  "answer": "The maximum borrowing period for premium members is 30 days, with unlimited renewals and no late fees.",
  "sources": [
    {
      "documentId": "uuid",
      "documentName": "library-policy.pdf",
      "snippet": "Premium members can borrow up to 10 books for 30 days...",
      "page": 5,
      "score": 0.92
    },
    {
      "documentId": "uuid",
      "documentName": "membership-guide.txt",
      "snippet": "Premium members enjoy unlimited renewals with no fines...",
      "page": null,
      "score": 0.87
    }
  ]
}
```

**Errors:**
- `400 Bad Request` - Missing question or invalid input

---

## Data Models

### User
```json
{
  "id": "uuid",
  "email": "string",
  "name": "string",
  "password": "string (hashed)",
  "role": "admin | librarian | member",
  "createdAt": "ISO 8601 timestamp",
  "updatedAt": "ISO 8601 timestamp"
}
```

### Book
```json
{
  "id": "uuid",
  "title": "string",
  "isbn": "string",
  "authorId": "uuid",
  "categoryId": "uuid",
  "publisherId": "uuid",
  "quantity": "number",
  "available": "number",
  "description": "string",
  "shelfSlotId": "uuid",
  "createdAt": "ISO 8601 timestamp",
  "updatedAt": "ISO 8601 timestamp"
}
```

### Member
```json
{
  "id": "uuid",
  "memberId": "string (unique)",
  "name": "string",
  "email": "string",
  "phone": "string",
  "plan": "basic | standard | premium",
  "status": "active | suspended | inactive",
  "memberSince": "ISO 8601 timestamp",
  "createdAt": "ISO 8601 timestamp",
  "updatedAt": "ISO 8601 timestamp"
}
```

### Borrow
```json
{
  "id": "uuid",
  "bookId": "uuid",
  "memberId": "uuid",
  "issuedAt": "ISO 8601 timestamp",
  "dueAt": "ISO 8601 timestamp",
  "returnedAt": "ISO 8601 timestamp | null",
  "status": "issued | returned | overdue",
  "renewalCount": "number",
  "createdAt": "ISO 8601 timestamp",
  "updatedAt": "ISO 8601 timestamp"
}
```

### Fine
```json
{
  "id": "uuid",
  "borrowId": "uuid",
  "amount": "number (decimal)",
  "reason": "overdue | damage | loss",
  "status": "pending | paid | waived",
  "createdAt": "ISO 8601 timestamp",
  "settledAt": "ISO 8601 timestamp | null"
}
```

### Document
```json
{
  "id": "uuid",
  "name": "string",
  "mimeType": "string",
  "size": "number (bytes)",
  "status": "processing | indexed | error",
  "chunkCount": "number",
  "uploadedBy": "uuid",
  "uploadedAt": "ISO 8601 timestamp",
  "indexedAt": "ISO 8601 timestamp | null"
}
```

### DocumentChunk
```json
{
  "id": "uuid",
  "documentId": "uuid",
  "content": "string",
  "page": "number | null",
  "embedding": "vector(1536)",
  "score": "number (cosine similarity)"
}
```

---

## Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters or validation failed |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions for the action |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists (e.g., duplicate email) |
| 422 | Unprocessable Entity | Validation error on specific fields |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error occurred |

---

## Rate Limiting

The API implements rate limiting to protect against abuse. Default limits:
- **15 requests per minute** for general endpoints
- **5 requests per minute** for document upload/indexing

Limit information is returned in response headers:
```
X-RateLimit-Limit: 15
X-RateLimit-Remaining: 12
X-RateLimit-Reset: 1705335600
```

---

## Pagination

List endpoints support the following pagination parameters:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | number | 1 | - | Page number (starts at 1) |
| `pageSize` | number | 10 | 100 | Items per page |

**Example:**
```
GET /books?page=2&pageSize=25
```

---

## Sorting

List endpoints support sorting with the following parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sortBy` | string | varies | Field to sort by (endpoint-specific) |
| `sortDir` | string | `asc` | Sort direction: `asc` or `desc` |

**Example:**
```
GET /books?sortBy=title&sortDir=asc
```

---

## Search

List endpoints support full-text search with the `search` parameter. The search field is endpoint-specific:

- **Books:** searches `title`, `isbn`, `author.name`
- **Members:** searches `name`, `email`, `phone`, `memberId`
- **Documents:** searches `name`
- **Borrows:** searches `book.title`, `member.name`

**Example:**
```
GET /books?search=fiction
```

---

## Swagger/OpenAPI

The complete API specification is available in OpenAPI 3.0 format at:
```
GET /api/docs/json
```

Swagger UI is available at:
```
http://localhost:4000/api/docs
```

---

## Examples

### Login Flow
```bash
# 1. Login
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@libraryos.io",
    "password": "admin123"
  }'

# Response: { "access_token": "eyJhbGc..." }

# 2. Use token for subsequent requests
curl -X GET http://localhost:4000/api/v1/books \
  -H "Authorization: Bearer eyJhbGc..."
```

### Upload and Query Documents
```bash
# 1. Upload a document
curl -X POST http://localhost:4000/api/v1/documents \
  -H "Authorization: Bearer eyJhbGc..." \
  -F "file=@library-policy.pdf"

# 2. List documents
curl -X GET http://localhost:4000/api/v1/documents \
  -H "Authorization: Bearer eyJhbGc..."

# 3. Chat with documents
curl -X POST http://localhost:4000/api/v1/rag/chat \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the membership plans?",
    "history": []
  }'
```

### Book Circulation
```bash
# 1. Issue a book to a member
curl -X POST http://localhost:4000/api/v1/borrows \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": "uuid",
    "bookId": "uuid"
  }'

# 2. Renew a borrow
curl -X POST http://localhost:4000/api/v1/borrows/uuid/renew \
  -H "Authorization: Bearer eyJhbGc..."

# 3. Return a book
curl -X POST http://localhost:4000/api/v1/borrows/uuid/return \
  -H "Authorization: Bearer eyJhbGc..."
```

---

## Support

For issues or questions about the API, please refer to:
- Swagger documentation: `http://localhost:4000/api/docs`
- Backend README: `backend/README.md`
- Project documentation: Root directory files
