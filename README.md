
# Fastify Socket Server

Fastify Socket Server is a modern API gateway built with Fastify, featuring WebSocket (Socket.IO) support, JWT authentication, Prometheus metrics, Swagger documentation, and data validation with Zod. The project is designed to be robust, scalable, and easy to integrate into Node.js applications that require real-time communication.

## Features

- **Fastify**: High-performance HTTP framework for Node.js.
- **Socket.IO**: Real-time bidirectional communication via WebSocket.
- **JWT**: Authentication using JSON Web Tokens.
- **Rate Limiting**: Request limiting to protect against abuse.
- **Swagger**: Automatic and interactive API documentation.
- **Prometheus Metrics**: Metrics exposure for monitoring.
- **Zod Validation**: Robust schemas for payload validation.

## Installation

Clone the repository and install dependencies:

```sh
pnpm install
```

## Configuration

Create a `.env` file in the project root with the following variable:

```
JWT_SECRET=your_secret_key
```

Other variables can be added as needed.

## Scripts

- `pnpm dev` — Starts the server in development mode with TypeScript.
- `pnpm build` — Generates the production bundle.
- `pnpm start` — Runs the generated bundle.
- `pnpm test` — Runs automated tests.
- `pnpm lint` — Checks code style with ESLint.

## Basic Usage

After starting the server, the API will be available at `http://localhost:3000` (or the configured port). Swagger documentation is accessible at `/docs`.

### JWT Authentication Example

1. Log in to obtain a JWT token.
2. Use the token in the `Authorization` header to access protected routes.

### Socket.IO Connection Example

```js
const socket = io('http://localhost:3000', {
  auth: { token: 'YOUR_JWT' }
});

socket.on('connect', () => {
  console.log('Connected to server!');
});
```

## Project Structure

- `src/` — Main source code
  - `server/` — Server initialization and configuration
  - `plugins/` — Custom Fastify plugins
  - `jwt/` — JWT authentication utilities
  - `socket/` — Socket.IO events and handlers
  - `validation/` — Zod schemas for validation
  - `utils/` — Utility functions
  - `errors/` — Custom error handling
- `test/` — Automated tests

## Testing

Tests use Jest. To run:

```sh
pnpm test
```

## Contributing

Pull requests are welcome! Please follow the code style defined by ESLint and maintain test coverage.

## License

MIT — Free use, with mandatory attribution to the original author.

---

Developed by wesleyadryel.
