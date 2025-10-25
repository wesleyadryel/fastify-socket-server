# Secure Chat Example with Parameter Validation

## Scenario: Building a Secure Chat Application

### 1. Create a Secure Chat Subscriber

```bash
curl -X POST http://localhost:3000/subscribers/with-validation \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventListener": "chatMessage",
    "replicable": true,
    "description": "Secure chat messages with validation",
    "parameters": [
      {
        "name": "message",
        "type": "string",
        "required": true,
        "sanitize": true,
        "maxLength": 1000,
        "pattern": "^[a-zA-Z0-9\\s.,!?-]+$"
      },
      {
        "name": "priority",
        "type": "string",
        "required": false,
        "sanitize": true,
        "allowedValues": ["low", "normal", "high", "urgent"]
      },
      {
        "name": "mentions",
        "type": "array",
        "required": false,
        "sanitize": true,
        "maxLength": 10
      },
      {
        "name": "metadata",
        "type": "object",
        "required": false,
        "sanitize": true
      }
    ]
  }'
```

### 2. Client-Side Usage

```javascript
// Emit a secure chat message
socket.emit('chatMessage', {
  message: 'Hello everyone!',
  priority: 'normal',
  mentions: ['@user1', '@user2'],
  metadata: { source: 'web', version: '1.0' },
  roomId: 'general'
}, (response) => {
  if (response.success) {
    console.log('Message sent successfully');
  } else {
    console.error('Validation failed:', response.error);
  }
});

// Listen for secure chat messages
socket.on('chatMessage', (data) => {
  console.log(`${data.userId}: ${data.message}`);
  console.log('Priority:', data.priority);
  console.log('Mentions:', data.mentions);
});
```

### 3. Security Features in Action

#### XSS Protection
```javascript
// This malicious input will be sanitized
socket.emit('chatMessage', {
  message: '<script>alert("XSS")</script>Hello World!',
  roomId: 'general'
});

// Result: "Hello World!" (script tags removed)
```

#### Length Validation
```javascript
// This will be truncated to maxLength
socket.emit('chatMessage', {
  message: 'A'.repeat(2000), // Exceeds maxLength of 1000
  roomId: 'general'
});

// Result: Message truncated to 1000 characters
```

#### Pattern Validation
```javascript
// This will fail pattern validation
socket.emit('chatMessage', {
  message: 'Hello @#$%^&*()', // Contains invalid characters
  roomId: 'general'
});

// Result: Validation error - pattern mismatch
```

#### Value Restrictions
```javascript
// This will fail allowedValues validation
socket.emit('chatMessage', {
  message: 'Hello',
  priority: 'invalid_priority', // Not in allowedValues
  roomId: 'general'
});

// Result: Validation error - invalid priority value
```

### 4. Private Events (Non-Replicable)

```bash
# Create a private event subscriber
curl -X POST http://localhost:3000/subscribers/with-validation \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "eventListener": "userTyping",
    "replicable": false,
    "description": "Private typing indicator - backend only",
    "parameters": [
      {
        "name": "isTyping",
        "type": "boolean",
        "required": true,
        "sanitize": true
      },
      {
        "name": "userId",
        "type": "string",
        "required": true,
        "sanitize": true,
        "pattern": "^[a-zA-Z0-9_-]+$"
      }
    ]
  }'
```

```javascript
// Emit private typing event
socket.emit('userTyping', {
  isTyping: true,
  userId: 'user123',
  roomId: 'general'
});

// This event will NOT be broadcast to other clients
// Only the backend will process it for logging/analytics
```

### 5. Error Handling

```javascript
socket.emit('chatMessage', {
  // Missing required 'message' parameter
  priority: 'normal',
  roomId: 'general'
}, (response) => {
  if (!response.success) {
    console.error('Validation failed:', response.error);
    // Handle validation error
    showErrorToUser(response.error);
  }
});
```

## Security Benefits

1. **XSS Prevention**: Automatic script tag removal
2. **Data Validation**: Type checking and format validation
3. **Size Limits**: Prevention of oversized payloads
4. **Value Restrictions**: Whitelist-based validation
5. **Private Events**: Sensitive data stays on backend
6. **Pattern Matching**: Regex-based input validation
7. **Type Safety**: Strict parameter type checking

## Best Practices

1. **Always use validation** for user-generated content
2. **Set appropriate limits** for string lengths
3. **Use allowedValues** for enum-like parameters
4. **Sanitize all string inputs** to prevent XSS
5. **Use non-replicable events** for sensitive operations
6. **Validate on both client and server** for better UX
7. **Log validation failures** for security monitoring
