<div align="center">
  <a href="https://dokploy.com">
    <img src=".github/sponsors/logo.png" alt="Dokploy - Open Source Alternative to Vercel, Heroku and Netlify." width="100%"  />
  </a>
  </br>
  </br>
</div>
<br />

Dokploy is a free, self-hostable Platform as a Service (PaaS) that simplifies the deployment and management of applications and databases.

## ✨ Features

- **Applications**: Deploy any type of application (Node.js, PHP, Python, Go, Ruby, etc.).
- **Databases**: MySQL, PostgreSQL, MongoDB, MariaDB, libsql, and Redis.
- **Backups**: Automate database backups to external S3-compatible storage.
- **Docker Compose**: Native support for Docker Compose to manage complex applications.
- **Multi Node**: Scale to multiple nodes using Docker Swarm.
- **Templates**: One-click deploy for open-source apps (Plausible, Pocketbase, Calcom, etc.).
- **Traefik Integration**: Automatic routing and SSL certificate management.
- **Real-time Monitoring**: Monitor CPU, memory, disk, and network for every container.
- **Volume Backups**: Schedule and restore Docker volume backups.
- **Docker Management**: Manage all Docker containers, images, and networks.
- **Notifications**: Slack, Discord, Telegram, Email and more.
- **Multi Server**: Deploy and manage apps on remote servers.
- **Self-Hosted**: Full control — run on any VPS.

## 🚀 Getting Started

### Fresh Install

Run the following command on a fresh Ubuntu/Debian VPS:

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

### Update (Self-Hosted via Docker Swarm)

To update your running Dokploy instance to the latest custom build:

**Latest stable build (from `main` branch):**
```bash
docker service update --image admin12mezba/dokploy:latest --force dokploy
```

**Canary build (experimental, from `canary` branch):**
```bash
docker service update --image admin12mezba/dokploy:canary --force dokploy
```

### What happens on install?

1. Docker + Docker Swarm is configured
2. Traefik reverse proxy is deployed
3. Dokploy service is started on port **3000**
4. Access the dashboard at `http://<YOUR_SERVER_IP>:3000`

For detailed documentation, visit [docs.dokploy.com](https://docs.dokploy.com).

## 📺 Video Tutorial

<a href="https://youtu.be/mznYKPvhcfw">
  <img src="https://dokploy.com/banner.png" alt="Watch the video" width="400"/>
</a>

## 🤝 Contributing

Check out the [Contributing Guide](CONTRIBUTING.md) for more information.
