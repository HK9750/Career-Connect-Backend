FROM node:18

WORKDIR /app

# Copy only package files first for caching install
COPY package*.json ./

# Install dependencies
RUN npm install

# Now copy the rest of the project (including prisma/)
COPY . .

# Run prisma generate AFTER prisma/schema.prisma is present
RUN npx prisma generate

EXPOSE 8000

CMD ["npm", "run", "dev"]
