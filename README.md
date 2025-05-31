# LLM Prompt Manager

A modern web application for managing your AI/LLM prompts with a clean, intuitive interface. Perfect for personal use to organize, categorize, and quickly access your collection of prompts.

![LLM Prompt Manager](https://via.placeholder.com/800x400/3B82F6/FFFFFF?text=LLM+Prompt+Manager)

## ✨ Features

- **📝 Prompt Management**: Create, edit, view, and delete prompts
- **🤖 AI-Powered Suggestions**: Get intelligent suggestions to improve your prompts using Anthropic's Claude API
- **🏷️ Categorization**: Organize prompts with customizable colored categories
- **🔖 Tagging System**: Add tags to prompts for better organization
- **🔍 Search & Filter**: Quickly find prompts by title, content, tags, or category
- **📋 Copy to Clipboard**: One-click copying of prompt content
- **📊 Export/Import**: Backup and restore your prompts as JSON files
- **📱 Responsive Design**: Works perfectly on desktop and mobile devices
- **🎨 Modern UI**: Clean, professional interface built with Tailwind CSS

### 🧠 AI Suggestions Feature

The AI Suggestions feature analyzes your prompts and provides:
- **Improvement recommendations** to make your prompts more effective
- **Suggested tags** based on content analysis
- **Readability scoring** to ensure clarity
- **Token estimation** for cost planning
- **Detailed analysis** covering clarity, specificity, and constraints

## 🛠️ Tech Stack

### Frontend
- React 18
- React Router DOM
- Tailwind CSS
- Lucide React (icons)
- React Hot Toast (notifications)
- Axios (HTTP client)

### Backend
- Node.js
- Express.js
- SQLite3 (database)
- node-fetch (for API calls)
- CORS enabled
- UUID for unique IDs
- Anthropic Claude API integration

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Anthropic API key (for AI suggestions feature)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd llm_prompt_manager
   ```

2. **Set up environment variables**
   
   Create a `.env` file in the server directory:
   ```bash
   cd server
   cp .env.example .env
   ```
   
   Edit the `.env` file and add your Anthropic API key:
   ```env
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   PORT=5001
   ```

3. **Install dependencies for all parts**
   ```bash
   cd ..
   npm run install-all
   ```

4. **Start the development servers**
   ```bash
   npm run dev
   ```

This will start:
- Backend server on http://localhost:5001
- Frontend development server on http://localhost:3000

### Manual Setup

If you prefer to set up each part manually:

1. **Install root dependencies**
   ```bash
   npm install
   ```

2. **Setup and start the backend**
   ```bash
   cd server
   npm install
   npm run dev
   ```

3. **Setup and start the frontend** (in a new terminal)
   ```bash
   cd client
   npm install
   npm start
   ```

## 🔑 API Key Setup

To use the AI suggestions feature, you'll need an Anthropic API key:

1. **Get an API key** from [Anthropic Console](https://console.anthropic.com)
2. **Add it to your environment** by creating a `.env` file in the server directory:
   ```env
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ```
3. **Test the integration** (optional):
   ```bash
   cd server
   npm run test-api
   ```
4. **Restart the server** if it's already running

**Note**: The AI suggestions feature will use intelligent fallback suggestions if no API key is provided, but you won't get the full AI-powered experience.

## 📖 Usage

### Getting Started

1. **Open your browser** and navigate to http://localhost:3000
2. **Create your first prompt** by clicking the "New Prompt" button
3. **Add categories** using the "+" button in the sidebar
4. **Organize your prompts** with tags and categories
5. **Get AI suggestions** when creating or editing prompts

### Key Functions

#### Creating Prompts with AI Suggestions
- Click "New Prompt" in the header
- Fill in the title and content (required)
- Select a category (optional)
- Click "Get Suggestions" to receive AI-powered improvements
- Review and apply suggested tags with one click
- Use the detailed analysis to refine your prompt
- Click "Create Prompt" to save

#### Using AI Suggestions
- **Write your prompt content** (at least 10 characters)
- **Click "Get Suggestions"** to analyze your prompt
- **Review improvements** suggested by AI
- **Add suggested tags** with one click
- **Check metrics** like token count and readability score
- **Apply detailed analysis** for clarity, specificity, and constraints

#### Managing Categories
- Use the "+" button next to "Categories" in the sidebar
- Choose a name and color for your category
- Categories help organize prompts visually

#### Search and Filter
- Use the search bar in the header to find prompts
- Click on categories in the sidebar to filter
- Search works across titles, content, and tags

#### Export/Import
- Go to Settings to export all your data as JSON
- Import previously exported data to restore prompts
- Useful for backing up or transferring data

## 🗂️ Project Structure

```
llm_prompt_manager/
├── package.json                 # Root package with scripts
├── README.md                   # This file
├── server/                     # Backend application
│   ├── package.json           # Server dependencies
│   ├── index.js              # Express server setup
│   ├── .env.example          # Environment variables template
│   └── prompts.db            # SQLite database (auto-generated)
└── client/                    # React frontend
    ├── package.json          # Client dependencies
    ├── public/               # Static files
    ├── src/
    │   ├── components/       # React components
    │   ├── services/         # API service
    │   ├── App.js           # Main app component
    │   ├── index.js         # Entry point
    │   └── index.css        # Tailwind CSS
    ├── tailwind.config.js   # Tailwind configuration
    └── postcss.config.js    # PostCSS configuration
```

## 🔧 Configuration

### Environment Variables

#### Server (.env file in `/server`)
```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here  # Required for AI suggestions
PORT=5001                                      # Server port
```

#### Client
The client automatically connects to the server on localhost:5001 in development.

### Database

The app uses SQLite for simplicity and portability. The database file (`prompts.db`) is automatically created in the server directory on first run.

#### Database Schema

**Prompts Table**
- `id` (TEXT PRIMARY KEY)
- `title` (TEXT NOT NULL)
- `content` (TEXT NOT NULL)
- `category` (TEXT)
- `tags` (TEXT)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

**Categories Table**
- `id` (TEXT PRIMARY KEY)
- `name` (TEXT UNIQUE NOT NULL)
- `color` (TEXT)
- `created_at` (DATETIME)

## 📡 API Endpoints

### Prompts
- `GET /api/prompts` - Get all prompts (with optional search/filter)
- `GET /api/prompts/:id` - Get single prompt
- `POST /api/prompts` - Create new prompt
- `PUT /api/prompts/:id` - Update prompt
- `DELETE /api/prompts/:id` - Delete prompt
- `POST /api/prompts/suggestions` - Get AI suggestions for a prompt

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create new category

### Data Management
- `GET /api/export` - Export all data
- `POST /api/import` - Import data
- `GET /api/health` - Health check

## 🎨 Customization

### Styling
The app uses Tailwind CSS for styling. You can customize:

1. **Colors**: Edit `client/tailwind.config.js`
2. **Component Styles**: Modify classes in `client/src/index.css`
3. **Theme**: Update color schemes in components

### Adding Features
The modular structure makes it easy to add features:

1. **New API endpoints**: Add routes in `server/index.js`
2. **New components**: Create in `client/src/components/`
3. **Database changes**: Modify schema in server startup

## 🚀 Production Deployment

### Building for Production

1. **Build the client**
   ```bash
   cd client
   npm run build
   ```

2. **Set up production server**
   ```bash
   cd server
   npm start
   ```

### Deploy Options

- **Heroku**: Use the included `package.json` scripts
- **DigitalOcean**: Deploy as a Node.js app
- **Vercel**: Frontend only with serverless functions
- **Self-hosted**: Use PM2 or similar process manager

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Icons by [Lucide](https://lucide.dev/)
- UI framework by [Tailwind CSS](https://tailwindcss.com/)
- Built with [React](https://reactjs.org/) and [Express](https://expressjs.com/)

## 📞 Support

If you encounter any issues or have questions:

1. Check the [troubleshooting section](#troubleshooting)
2. Look through existing issues
3. Create a new issue with details

### Troubleshooting

**Common Issues:**

1. **Port already in use**: Change the port in server configuration
2. **Database errors**: Delete `server/prompts.db` to reset
3. **Build failures**: Clear `node_modules` and reinstall dependencies
4. **CORS issues**: Ensure the server is running on the correct port

**Reset Everything:**
```bash
# Stop all servers
# Delete node_modules in root, server, and client
rm -rf node_modules server/node_modules client/node_modules
# Delete database
rm server/prompts.db
# Reinstall everything
npm run install-all
``` 