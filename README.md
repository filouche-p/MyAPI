# State
Unfinished

# Setup
Create .env file with the base of .env.example :
```sh
cp .env.example .env
```
Fill the .env file<br>
You can use this commmand to generate a jwt secret
```sh
openssl rand -base64 32 | tr -d '\n'
```
Or
```sh
openssl rand -hex 32
```
Or native linux command
```sh
od -vN 32 -An -tx1 /dev/urandom | tr -d ' \n'
```

**After** run :
```sh
npm install
cd frontend && npm install
```

To run the project with Docker (Recommended) :
```sh
docker compose up -d --build
```

To run the project locally (Development) :
You need to open two terminals :
1. For the Backend API : `npm start`
2. For the Frontend (Vite) : `cd frontend && npm run dev`

# Url
When running on Docker, everything is exposed on :
- Webpage / API : [http://localhost:8080](http://localhost:8080)
- Swagger API Documentation : [http://localhost:8080/api-docs](http://localhost:8080/api-docs)
- mongodb : [http://localhost:27017](http://localhost:27017)
- redis : [http://localhost:6379](http://localhost:6379)

# Data
All of the given data need to be in json type file placed in the db folder, every json file **will** be registered
Data is provided by the [minecraft-data repo on github](https://github.com/PrismarineJS/minecraft-data) currently on the [26.1 pc version]((https://github.com/PrismarineJS/minecraft-data/tree/master/data/pc/26.1))