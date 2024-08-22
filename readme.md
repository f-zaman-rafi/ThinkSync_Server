# ThinkSync Backend

Welcome to the ThinkSync Backend repository! This project is the server-side code for the ThinkSync online learning platform.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the Project](#running-the-project)
- [API Endpoints](#api-endpoints)
  - [Auth Routes](#auth-routes)
  - [User Routes](#user-routes)
  - [Session Routes](#session-routes)
  - [Booking Routes](#booking-routes)
  - [Material Routes](#material-routes)
- [Middleware](#middleware)
- [Database Schema](#database-schema)
- [Contributing](#contributing)
- [License](#license)

## Features

- User authentication and JWT token management
- Role-based access control (Admin, Tutor, Student)
- Session management (Create, approve, book sessions)
- Material management (Upload and access study materials)
- Integrated payment processing with Stripe

## Tech Stack

- **Node.js**: JavaScript runtime environment
- **Express.js**: Web application framework for Node.js
- **MongoDB**: NoSQL database
- **JWT**: JSON Web Tokens for authentication
- **Stripe**: Payment processing
- **dotenv**: Environment variable management
- **cors**: Middleware for Cross-Origin Resource Sharing

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/thinksync-backend.git
   cd thinksync-backend
