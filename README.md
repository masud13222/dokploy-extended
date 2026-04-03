<div align="center">
  <a href="https://github.com/masud13222/dokploy-extended">
    <img src=".github/sponsors/logo.png" alt="Dokploy Extended - Open Source Alternative to Vercel, Heroku and Netlify." width="100%"  />
  </a>
  </br>
  </br>
</div>

<div align="center">

### 🚀 Quick Install

```bash
curl -sSL https://raw.githubusercontent.com/masud13222/dokploy-extended/main/install.sh | sh
```

### 🗑️ Uninstall

```bash
curl -sSL https://raw.githubusercontent.com/masud13222/dokploy-extended/main/uninstall.sh | sh
```

</div>

<br />

Dokploy Extended is a free, self-hostable Platform as a Service (PaaS) that simplifies the deployment and management of applications and databases. This is a customized fork of [Dokploy](https://dokploy.com) with additional features and improvements.

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
curl -sSL https://raw.githubusercontent.com/masud13222/dokploy-extended/main/install.sh | sh
```

> **Testing/Force install** (skip port checks):
> ```bash
> curl -sSL https://raw.githubusercontent.com/masud13222/dokploy-extended/main/install.sh | sh -s -- --force
> ```

### Update

**Auto version detect করে update (recommended):**
```bash
curl -sSL https://raw.githubusercontent.com/masud13222/dokploy-extended/main/install.sh | sh -s update
```

**Latest stable build (from `main` branch):**
```bash
docker service update --image admin12mezba/dokploy:latest --force dokploy
```

**Canary build (experimental, from `canary` branch):**
```bash
docker service update --image admin12mezba/dokploy:canary --force dokploy
```

### Uninstall

**Normal uninstall** (data volumes রাখবে):
```bash
curl -sSL https://raw.githubusercontent.com/masud13222/dokploy-extended/main/uninstall.sh | sh
```

**সব কিছু মুছে ফেলুন** (volumes + config সহ):
```bash
curl -sSL https://raw.githubusercontent.com/masud13222/dokploy-extended/main/uninstall.sh | sh -s -- --purge
```

### What happens on install?

1. Docker + Docker Swarm is configured
2. Traefik reverse proxy is deployed
3. Dokploy Extended service is started on port **3000**
4. Access the dashboard at `http://<YOUR_SERVER_IP>:3000`

For detailed documentation, visit [docs.dokploy.com](https://docs.dokploy.com).

## 📺 Video Tutorial

<a href="https://youtu.be/mznYKPvhcfw">
  <img src="https://dokploy.com/banner.png" alt="Watch the video" width="400"/>
</a>

## 🤝 Contributing

Check out the [Contributing Guide](CONTRIBUTING.md) for more information.
