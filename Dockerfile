# Use a lightweight Node.js image
FROM node:20-slim

# Create and set the working directory
WORKDIR /app

# Copy package files first to leverage Docker caching
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Create the data directory if it doesn't exist
RUN mkdir -p data

# The app listens on port 3000 by default
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
