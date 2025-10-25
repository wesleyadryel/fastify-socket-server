# Security Example: Replicable vs Non-Replicable Events

## Scenario: Chat Application with Sensitive Operations

### Public Events (replicable: true)
```javascript
// Subscriber for public chat messages
{
  "eventListener": "chatMessage",
  "replicable": true,
  "description": "Public chat messages visible to all users"
}

// Client emits message
socket.emit('chatMessage', {
  message: 'Hello everyone!',
  roomId: 'general'
});

// All clients in 'general' room receive the same event
socket.on('chatMessage', (data) => {
  console.log(`${data.userId}: ${data.message}`);
});
```

### Private Events (replicable: false)
```javascript
// Subscriber for private user actions
{
  "eventListener": "userTyping",
  "replicable": false,
  "description": "Private typing indicator - backend only"
}

// Client emits typing event
socket.emit('userTyping', {
  isTyping: true,
  roomId: 'general'
});

// Only the backend processes this - no other clients receive it
// Backend can log, store, or perform actions without broadcasting
```

### Sensitive Operations (replicable: false)
```javascript
// Subscriber for password changes
{
  "eventListener": "changePassword",
  "replicable": false,
  "description": "Password change - backend processing only"
}

// Client emits password change
socket.emit('changePassword', {
  newPassword: 'encrypted_password',
  roomId: 'user123'
});

// Backend processes securely without broadcasting to other clients
```

## Use Cases

### replicable: true
- Chat messages
- Game moves
- Notifications
- Status updates
- Public announcements

### replicable: false
- Authentication events
- Password changes
- Private user data
- Admin actions
- Sensitive operations
- Logging events
- Database operations

## Security Benefits

1. **Data Privacy**: Sensitive information stays on the backend
2. **Performance**: Reduces unnecessary network traffic
3. **Security**: Prevents sensitive data from being broadcast
4. **Control**: Backend has full control over event processing
5. **Compliance**: Helps meet data protection requirements
