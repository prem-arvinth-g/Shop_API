# One container = Angular site + .NET API. Same image runs on Render, AWS Lightsail/App Runner, or any Docker host.

# 1) Build the Angular site into static files
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npx ng build

# 2) Build the .NET API
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src
COPY backend/ShopApi.csproj backend/
RUN dotnet restore backend/ShopApi.csproj
COPY backend/ backend/
RUN dotnet publish backend/ShopApi.csproj -c Release -o /app

# 3) Small runtime image: API + Angular files in wwwroot
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=api /app ./
COPY --from=web /web/dist/browser ./wwwroot
USER $APP_UID
# Render (and most hosts) tell the app which port to use through $PORT.
CMD ["sh", "-c", "ASPNETCORE_HTTP_PORTS=${PORT:-8080} exec dotnet ShopApi.dll"]
