# Docker Commands

## 🚀 Quick Start (Recommended)
```bash
# Build and start all services (Redis + App)
docker compose up -d --build
```

## 📦 Build Commands

### Build only the application image
```bash
# Build with tag
docker build -t fastify-socket-server .

# Build with specific Node version
docker build --build-arg NODE_VERSION=22.16.0 -t fastify-socket-server .
```

### Build using docker-compose
```bash
# Build all services
docker compose build

# Build only the app service
docker compose build app
```

## 🏃‍♂️ Run Commands

### Start services
```bash
# Start all services (Redis + App)
docker compose up -d

# Start with logs visible
docker compose up

# Start and rebuild
docker compose up -d --build
```

### Run standalone container
```bash
# Run the built image directly
docker run -d -p 3000:3000 --name socket-server fastify-socket-server

# Run with environment variables
docker run -d -p 3000:3000 -e NODE_ENV=production --name socket-server fastify-socket-server
```

## 🔧 Management Commands

### Stop services
```bash
# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v
```

### View logs
```bash
# View all logs
docker compose logs -f

# View only app logs
docker compose logs -f app

# View only Redis logs
docker compose logs -f redis
```

### Container management
```bash
# Access the container shell
docker exec -it fastify-socket-server-app-1 bash

# View container status
docker compose ps

# Restart services
docker compose restart
```

## 🧹 Cleanup Commands

### Remove containers and images
```bash
# Remove containers
docker compose down --rmi all

# Remove everything (containers, images, volumes)
docker compose down -v --rmi all --remove-orphans

# Clean up unused Docker resources
docker system prune -a
```

## 📊 Monitoring Commands

### Check resource usage
```bash
# View container stats
docker stats

# View specific container stats
docker stats fastify-socket-server-app-1
```

### Health checks
```bash
# Check if app is responding
curl http://localhost:3000/health

# Check container health
docker inspect fastify-socket-server-app-1 --format='{{.State.Health.Status}}'
```
