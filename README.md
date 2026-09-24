# State
Unfinished

# Setup
Create a `.env` file based on `.env.example`:
```sh
cp .env.example .env
```
Fill out the `.env` file.  
You can use one of these commands to generate a secure JWT secret:
```sh
openssl rand -base64 32 | tr -d '\n'
```
Or:
```sh
openssl rand -hex 32
```
Or using a native Linux command:
```sh
od -vN 32 -An -tx1 /dev/urandom | tr -d ' \n'
```

**Afterward**, run:
```sh
npm install
cd frontend && npm install
```

To run the project with Docker in **Production Mode** (Caddy for frontend with automatic HTTPS, optimized):
*Note: The Docker containers do not use volume mounts for the source code. You must re-run this command with `--build` if you modify the code.*
```sh
./start.sh
# OR manually: docker compose up -d --build
```

To run the project with Docker in **Development Mode** (Vite Dev Server, Live Reload):
*Note: This maps your local `frontend` folder directly to the container. Any change to your code will instantly update the browser.*
```sh
./start-dev.sh
# OR manually: docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

# URLs
When running on Docker, the services are exposed on the following ports:
- **Frontend Application (Vite/Caddy)**: [http://localhost:8081](http://localhost:8081) *(Default port, can be changed via FRONTEND_PORT in .env)*
- **Backend API (Express)**: [http://localhost:8080](http://localhost:8080)
- **Swagger API Documentation**: [http://localhost:8080/api-docs](http://localhost:8080/api-docs)
- **MongoDB**: [http://localhost:27017](http://localhost:27017)
- **Redis**: [http://localhost:6379](http://localhost:6379)

# Data
The database relies on `.json` files located in the `db` folder. **You do not need to download or place these files manually.**

Data is provided by the [minecraft-data repo on GitHub](https://github.com/PrismarineJS/minecraft-data). An auto-update feature automatically downloads and loads the latest data from the repository when the server starts. Furthermore, it updates automatically every Wednesday at 3:00 AM via a cron job.

# Project Structure
The project is split into separate Docker containers: a Node.js backend API and a Caddy-served Vite + Tailwind CSS frontend. Caddy automatically handles HTTPS in production when a domain name is provided.

### Frontend (`/frontend`)
- `index.html`: The main entry point for the Vite application.
- `src/css/`: Contains the styling files, including `style.css` where Tailwind is imported and custom CSS is written.
- `src/pages/`: Contains the secondary HTML pages (`login.html`, `register.html`, `test.html`). Vite is configured to compile them automatically.
- `src/main.js`: Main JavaScript entry point for the homepage.
- `vite.config.js`: Vite configuration, managing the multiple HTML entry points and proxying API requests to the backend.

# API Routes & Usage

For full technical details, you can always consult the [Swagger API Documentation](http://localhost:8080/api-docs) once the server is running.

Here are the details of the available routes and some **important subtleties** regarding how data is queried.

### Important Subtleties

1. **The `minecraft:` Prefix**:
   In the database, the unique key (`key_name`) of each block or item includes the `minecraft:` prefix. 
   [X] `http://localhost:8080/api/blocks/dirt` (Will not work)
   [OK] `http://localhost:8080/api/blocks/minecraft:dirt` (Will work)

2. **Partial Search with `_like`**:
   The API allows partial searches (for example, "all blocks containing 'dirt'"). However, the database objects do **not** have a `name` field. Their full name is stored in the `key_name` field.
   Therefore, you must use the `key_name_like` parameter (and not `name_like`).
   [X] `http://localhost:8080/api/blocks?name_like=dirt` (Will return nothing)
   [OK] `http://localhost:8080/api/blocks?key_name_like=dirt` (Will return the expected results)

### Available Routes

#### `GET /api/:table_name` (Retrieve all items)
Retrieves all items from a collection with pagination support.
- **Parameters:** `page` (default: 1). You can also dynamically filter on any attribute.
- **Examples:**
  - [http://localhost:8080/api/blocks](http://localhost:8080/api/blocks) (Retrieves page 1 of blocks)
  - [http://localhost:8080/api/blocks?page=2](http://localhost:8080/api/blocks?page=2) (Retrieves page 2 of blocks)
  - [http://localhost:8080/api/blocks?key_name_like=dirt](http://localhost:8080/api/blocks?key_name_like=dirt) (Searches for all blocks containing 'dirt')

#### `GET /api/:table_name/:key_name` (Retrieve a specific item)
Retrieves the exact details of an item via its identifier. Do not forget the prefix if necessary.
- **Examples:**
  - [http://localhost:8080/api/blocks/minecraft:dirt](http://localhost:8080/api/blocks/minecraft:dirt)
  - [http://localhost:8080/api/blocks/minecraft:acacia_button](http://localhost:8080/api/blocks/minecraft:acacia_button)

#### `POST /api/:table_name` (Create an item - Authentication required)
Creates a new item. The `Authorization: Bearer <token>` header is required, and the body must contain a `key_name` field.

#### `PUT /api/:table_name/:key_name` (Update an item - Authentication required)
Updates an existing item via its `key_name` identifier. The `Authorization: Bearer <token>` header is required.

#### `DELETE /api/:table_name/:key_name` (Delete an item - Authentication required)
Deletes the specified item. The `Authorization: Bearer <token>` header is required.

#### Authentication Routes
- **`POST /register`**: Create a new user with a `username` and `password`.
- **`POST /login`**: Log in and retrieve a JWT token.
- **`POST /logout`**: Log out and clear the JWT token.
- **`GET /auth/google`**: Log in using Google OAuth2.