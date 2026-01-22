# Collaborative Wiki

A simple, collaborative wiki built with Node.js, Express, and SQLite.

## Features
- **Markdown Support**: Create and view pages using Markdown.
- **SQLite Database**: Lightweight data storage (no separate DB server needed).
- **Responsive Design**: Clean and modern styling.

## Prerequisites
- [Node.js](https://nodejs.org/) (Version 18 or higher recommended)

## Setup & Running

Follow these steps to get the project running on your local machine:

1. **Install Dependencies**
   Navigate to the project folder in your terminal and run:
   ```bash
   npm install
   ```

2. **Start the Server**
   Run the following command to start the application:
   ```bash
   npm start
   ```
   *By default, the server runs on port 3000.*

3. **Access in Browser**
   Open your browser and visit:
   [http://localhost:3000](http://localhost:3000)

### Troubleshooting: Port Busy
 If you see an error like `EADDRINUSE: address already in use :::3000`, it means another program is using port 3000. You can run the wiki on a different port (e.g., 3001) like this:
 ```bash
 PORT=3001 npm start
 ```
 Then go to [http://localhost:3001](http://localhost:3001).

## Project Structure
- `server.js`: The application entry point.
- `database.js`: SQLite configuration and table initialization.
- `/src/routes`: API and page route handlers.
- `/src/models`: Database interaction logic.
- `/src/views`: HTML templates (using EJS).
- `/src/public`: Static assets (CSS, images).
- `wiki.db`: The SQLite database file (generated automatically).

## How to Use
1. **Home Page**: See a list of all existing wiki pages.
2. **Create Page**: Click "Create New Page" to add a new page. Enter a title (the slug will auto-generate) and write your content in Markdown.
3. **View Page**: Click on any page title from the home list to view its contents rendered as HTML.
