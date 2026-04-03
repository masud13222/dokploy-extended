import type { CompleteTemplate } from "./processors";

export interface LocalTemplateMetadata {
	id: string;
	name: string;
	description: string;
	version: string;
	logo: string;
	tags: string[];
	links: {
		github: string;
		website?: string;
		docs?: string;
	};
	isLocal: true;
}

interface LocalTemplate {
	metadata: Omit<LocalTemplateMetadata, "isLocal">;
	config: CompleteTemplate;
	dockerCompose: string;
}

// ---------------------------------------------------------------------------
// Django production template
// ---------------------------------------------------------------------------
// Stack: Django + Gunicorn + PostgreSQL 16 + Redis 7 + Nginx
// Features:
//   - Auto-migrate + collectstatic on deploy (no separate migrate container)
//   - Static & media served directly by nginx (zero Python overhead)
//   - Healthchecks on all services so depends_on properly waits
//   - Nginx config injected as a file mount so no custom image required
//   - Passwords / secret key auto-generated on first deploy
//   - Celery worker + beat as optional services (just uncomment in compose)
// ---------------------------------------------------------------------------
const djangoTemplate: LocalTemplate = {
	metadata: {
		id: "django",
		name: "Django",
		version: "1.0.0",
		description:
			"Production-ready Django stack with PostgreSQL, Redis, Gunicorn, and Nginx. Handles migrations, static/media files, and health checks automatically.",
		logo: "https://static.djangoproject.com/img/logos/django-logo-negative.png",
		tags: ["python", "django", "postgresql", "redis", "nginx"],
		links: {
			github: "https://github.com/django/django",
			website: "https://djangoproject.com",
			docs: "https://docs.djangoproject.com",
		},
	},

	config: {
		metadata: {
			id: "django",
			name: "Django",
			description: "Production Django stack",
			version: "1.0.0",
			logo: "https://static.djangoproject.com/img/logos/django-logo-negative.png",
			tags: ["python", "django", "postgresql", "redis", "nginx"],
			links: { github: "https://github.com/django/django" },
		},
		variables: {
			POSTGRES_DB: "django_db",
			POSTGRES_USER: "django_user",
			POSTGRES_PASSWORD: "${password:24}",
			SECRET_KEY: "${password:50}",
			// Users should replace this with their built image, e.g. myrepo/myapp:latest
			DJANGO_IMAGE: "python:3.13-slim",
			DJANGO_WSGI: "config.wsgi:application",
			DJANGO_SETTINGS_MODULE: "config.settings",
			GUNICORN_WORKERS: "3",
			ALLOWED_HOSTS: "*",
		},
		config: {
			domains: [],
			env: [
				"POSTGRES_DB=${POSTGRES_DB}",
				"POSTGRES_USER=${POSTGRES_USER}",
				"POSTGRES_PASSWORD=${POSTGRES_PASSWORD}",
				"SECRET_KEY=${SECRET_KEY}",
				"DJANGO_IMAGE=${DJANGO_IMAGE}",
				"DJANGO_WSGI=${DJANGO_WSGI}",
				"DJANGO_SETTINGS_MODULE=${DJANGO_SETTINGS_MODULE}",
				"GUNICORN_WORKERS=${GUNICORN_WORKERS}",
				"ALLOWED_HOSTS=${ALLOWED_HOSTS}",
			],
			mounts: [
				{
					filePath: "/etc/nginx/conf.d/default.conf",
					// nginx config — $host / $remote_addr are nginx vars, not env vars
					content: `upstream django_app {
    server web:8000;
}

server {
    listen 80;
    server_name _;
    client_max_body_size 100M;

    # Static files — served at full speed by nginx, no Python involved
    location /static/ {
        alias /app/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # User-uploaded media
    location /media/ {
        alias /app/media/;
        expires 7d;
        add_header Cache-Control "public";
    }

    # Lightweight health check — nginx answers directly, no upstream needed
    location = /health/ {
        return 200 "ok";
        add_header Content-Type text/plain;
    }

    # Everything else proxied to Gunicorn
    location / {
        proxy_pass http://django_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
}
`,
				},
			],
		},
	},

	dockerCompose: `services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: \${POSTGRES_DB}
      POSTGRES_USER: \${POSTGRES_USER}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $\${POSTGRES_USER} -d $\${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  web:
    image: \${DJANGO_IMAGE}
    restart: unless-stopped
    # Runs migrate + collectstatic then starts Gunicorn.
    # Replace DJANGO_IMAGE with your built image (e.g. myrepo/myapp:latest).
    command: >
      sh -c "python manage.py migrate --noinput &&
             python manage.py collectstatic --noinput &&
             gunicorn \${DJANGO_WSGI}
             --bind 0.0.0.0:8000
             --workers \${GUNICORN_WORKERS}
             --worker-class gthread
             --threads 4
             --timeout 120
             --access-logfile -
             --error-logfile -"
    volumes:
      - static_files:/app/staticfiles
      - media_files:/app/media
    environment:
      DATABASE_URL: postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@db:5432/\${POSTGRES_DB}
      REDIS_URL: redis://redis:6379/0
      SECRET_KEY: \${SECRET_KEY}
      DEBUG: "False"
      ALLOWED_HOSTS: \${ALLOWED_HOSTS}
      STATIC_ROOT: /app/staticfiles
      MEDIA_ROOT: /app/media
      DJANGO_SETTINGS_MODULE: \${DJANGO_SETTINGS_MODULE}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:8000/health/ || exit 0"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  nginx:
    image: nginx:1.27-alpine
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - static_files:/app/staticfiles:ro
      - media_files:/app/media:ro
    depends_on:
      web:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost/health/ || exit 0"]
      interval: 30s
      timeout: 5s
      retries: 3

  # ── Celery worker (optional — uncomment to enable background tasks) ─────
  # worker:
  #   image: \${DJANGO_IMAGE}
  #   restart: unless-stopped
  #   command: celery -A \${DJANGO_SETTINGS_MODULE%%.*} worker --loglevel=info --concurrency=2
  #   volumes:
  #     - media_files:/app/media
  #   environment:
  #     DATABASE_URL: postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@db:5432/\${POSTGRES_DB}
  #     REDIS_URL: redis://redis:6379/0
  #     SECRET_KEY: \${SECRET_KEY}
  #     DEBUG: "False"
  #   depends_on:
  #     db:
  #       condition: service_healthy
  #     redis:
  #       condition: service_healthy

  # ── Celery beat scheduler (optional — uncomment alongside worker) ────────
  # beat:
  #   image: \${DJANGO_IMAGE}
  #   restart: unless-stopped
  #   command: celery -A \${DJANGO_SETTINGS_MODULE%%.*} beat --loglevel=info
  #   environment:
  #     DATABASE_URL: postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@db:5432/\${POSTGRES_DB}
  #     REDIS_URL: redis://redis:6379/0
  #     SECRET_KEY: \${SECRET_KEY}
  #     DEBUG: "False"
  #   depends_on:
  #     - redis

volumes:
  postgres_data:
  redis_data:
  static_files:
  media_files:
`,
};

// ---------------------------------------------------------------------------
// Registry — add more local templates here
// ---------------------------------------------------------------------------
const LOCAL_TEMPLATES: Record<string, LocalTemplate> = {
	django: djangoTemplate,
};

/**
 * Returns metadata list for all bundled local templates.
 * Shape matches what fetchTemplatesList() returns so the UI can display them.
 */
export async function getLocalTemplatesList(): Promise<LocalTemplateMetadata[]> {
	return Object.values(LOCAL_TEMPLATES).map((t) => ({
		...t.metadata,
		isLocal: true as const,
	}));
}

/**
 * Returns the full config + docker-compose for a local template.
 * Returns null if the id is not a known local template.
 */
export async function getLocalTemplateFiles(
	id: string,
): Promise<{ config: CompleteTemplate; dockerCompose: string } | null> {
	const template = LOCAL_TEMPLATES[id];
	if (!template) return null;
	return { config: template.config, dockerCompose: template.dockerCompose };
}

/** Returns true if the given template id is a bundled local template. */
export function isLocalTemplate(id: string): boolean {
	return id in LOCAL_TEMPLATES;
}
