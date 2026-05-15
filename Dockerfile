# Defines the containerized Node.js environment for running the Vite app without
# installing project dependencies directly on the host machine.
FROM node:24-alpine

WORKDIR /app

# Run installation and the dev server as the unprivileged node user.
RUN chown node:node /app
USER node

COPY --chown=node:node package*.json .npmrc ./
RUN npm install --no-audit --no-fund

COPY --chown=node:node . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
