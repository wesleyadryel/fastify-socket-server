# Fastify Socket.IO Gateway

A Fastify server with Socket.IO integration for real-time communication, JWT authentication, and metrics monitoring.

## 🚀 Features

- **Fastify** - Fast and efficient web framework
- **Socket.IO** - Real-time communication
- **JWT Authentication** - Token-based authentication
- **Rate Limiting** - Protection against abuse
- **Health Check** - Server health monitoring
- **Metrics** - Integrated Prometheus metrics
- **Swagger/OpenAPI** - Automatic API documentation
- **TypeScript** - Static typing
- **Zod Validation** - Schema validation

## 📋 Prerequisites

- Node.js 20+
- pnpm (recommended) or npm

## 🛠️ Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd fastify-socket-server
```

2. Install dependencies:
```bash
pnpm install
# or
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

## ⚙️ Configuration

Create a `.env` file in the project root with the following variables:

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=1h

# API Token (for JWT routes authentication)
API_TOKEN=your-api-token

# Environment
NODE_ENV=development
Debug=true

# Prometheus Metrics
PROMETHEUS_PREFIX=node_fastfy
```

## 🚀 Running the Project

### Development
```bash
# Development mode with hot reload
pnpm dev

# Development mode with logs
pnpm dev:log
```

### Production
```bash
# Build the project
pnpm build

# Run in production
pnpm start
```

### Other Commands
```bash
# Clean build
pnpm clean

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Linting
pnpm lint

# Code formatting
pnpm format
```

## 📡 API Endpoints

### JWT Authentication

All JWT routes require authentication via `Authorization: Bearer <API_TOKEN>` header.

#### POST `/jwt/create`
Creates a new JWT token for a user.

**Headers:**
```
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "userId": "user123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST `/jwt/verify`
Verifies the validity of a JWT token.

**Headers:**
```
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "valid": true,
  "payload": {
    "userId": "user123",
    "iat": 1234567890,
    "exp": 1234571490
  }
}
```

**Response (Invalid token):**
```json
{
  "valid": false,
  "error": "jwt expired",
  "payload": null
}
```

#### POST `/jwt/decode`
Decodes a JWT token without verifying the signature.

**Headers:**
```
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "payload": {
    "userId": "user123",
    "iat": 1234567890,
    "exp": 1234571490
  }
}
```

### Health Check

#### GET `/alive`
Server health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Metrics

#### GET `/metrics`
Prometheus metrics endpoint.

**Response:**
```
# HELP node_fastfy_http_requests_total Total number of HTTP requests
# TYPE node_fastfy_http_requests_total counter
node_fastfy_http_requests_total{app="node_fastfy-gateway",env="development",method="GET",route="/",status_code="200"} 1
```

## 🔌 Socket.IO Events

### Authentication

To connect via Socket.IO, you must provide a valid JWT token:

```javascript
// Via query parameter
const socket = io('http://localhost:3000', {
  query: {
    token: 'your-jwt-token'
  }
});

// Via auth object
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});

// Via headers
const socket = io('http://localhost:3000', {
  extraHeaders: {
    token: 'your-jwt-token'
  }
});
```

### Available Events

#### `sendMessage`
Sends a message to a specific room.

**Parameters:**
```json
{
  "content": "Hello, world!",
  "roomId": "room123",
  "type": "text"
}
```

**Message types:**
- `text` - Text message (default)
- `system` - System message
- `notification` - Notification

**Callback Response:**
```json
{
  "success": true,
  "data": {
    "content": "Hello, world!",
    "roomId": "room123",
    "type": "text"
  }
}
```

#### `joinRoom`
Joins a specific room.

**Parameters:**
```javascript
socket.emit('joinRoom', 'room123', (response) => {
  console.log(response);
});
```

**Callback Response:**
```json
{
  "success": true,
  "data": {
    "roomId": "room123"
  }
}
```

#### `leaveRoom`
Leaves a specific room.

**Parameters:**
```javascript
socket.emit('leaveRoom', 'room123', (response) => {
  console.log(response);
});
```

**Callback Response:**
```json
{
  "success": true,
  "data": {
    "roomId": "room123"
  }
}
```

### Received Events

#### `messageReceived`
Received when a message is sent to the room.

```json
{
  "content": "Hello, world!",
  "roomId": "room123",
  "type": "text",
  "userId": "user123",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### `userJoined`
Received when a user joins the room.

```json
{
  "userId": "user123",
  "roomId": "room123"
}
```

#### `userLeft`
Received when a user leaves the room.

```json
{
  "userId": "user123",
  "roomId": "room123"
}
```

## 📊 Monitoring

### Rate Limiting

The server implements rate limiting with the following configuration:
- **Maximum:** 100 requests per minute
- **Ban:** 10 excess requests
- **Time Window:** 1 minute

### Prometheus Metrics

The server exposes metrics at the `/metrics` endpoint:

- `node_fastfy_http_requests_total` - Total HTTP requests
- `node_fastfy_http_request_duration_seconds` - Request duration
- `node_fastfy_custom_active_connections` - Active connections
- `node_fastfy_custom_requests_total` - Custom request counter

### Health Check

The `/alive` endpoint checks:
- Event Loop Delay (maximum: 5000ms)
- Heap Used Bytes (maximum: 1GB)
- RSS Bytes (maximum: 2GB)
- Event Loop Utilization (maximum: 99%)

## 📚 API Documentation

Access the interactive API documentation at:
- **Swagger UI:** `http://localhost:3000/docs`
- **OpenAPI JSON:** `http://localhost:3000/openapi.json`

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

### Test Example

```typescript
import { generateTestToken } from './test/jwt-util';

// Generate test token
const token = generateTestToken('user123');

// Use the token in tests
const response = await app.inject({
  method: 'POST',
  url: '/jwt/verify',
  headers: {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json'
  },
  payload: { token }
});
```

## 🔧 Development

### Project Structure

```
src/
├── errors/           # Error handling
├── jwt/             # JWT authentication
├── plugins/         # Fastify plugins
├── server/          # Server configuration
├── socket/          # Socket.IO events
├── utils/           # Utilities
└── validation/      # Validation schemas
```

### Adding New Socket.IO Events

1. Create the handler in `src/socket/events.ts`:
```typescript
export function handleCustomEvent(socket: Socket) {
  socket.on('customEvent', (data: any, callback: (response: any) => void) => {
    // Your logic here
    callback({ success: true, data });
  });
}
```

2. Register the handler in `src/socket/index.ts`:
```typescript
import { handleCustomEvent } from './events';

export function registerSocketHandlers(socket: Socket) {
  // ... other handlers
  handleCustomEvent(socket);
}
```

### Adding New Routes

1. Create the plugin in `src/plugins/`:
```typescript
import { FastifyInstance } from 'fastify';

export default async function customPlugin(fastify: FastifyInstance) {
  fastify.get('/custom', async (request, reply) => {
    return { message: 'Custom route' };
  });
}
```

2. Register the plugin in `src/server/index.ts`:
```typescript
import customPlugin from '../plugins/custom';

app.register(customPlugin);
```

## 🚀 Deploy

### Docker (Example)

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

EXPOSE 3000

CMD ["npm", "start"]
```

### Production Environment Variables

```env
NODE_ENV=production
JWT_SECRET=your-production-secret
API_TOKEN=your-production-api-token
PROMETHEUS_PREFIX=production_app
```

## 📝 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For support, open an issue in the repository or contact the author.

---

**Author:** Wesley Adryel  
**Version:** 1.0.0  
**License:** MIT