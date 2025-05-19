FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

# Run prisma generate after installing dependencies
RUN npx prisma generate

COPY . .

EXPOSE 8000

CMD ["npm", "run", "dev"]
