# File Upload & Download Service

A simple web application for uploading files and generating shareable download links. Perfect for sharing files temporarily with others.

## Features

- 📁 Upload multiple files (up to 10 files, 50MB each)
- 🔗 Generate unique download links
- 📦 Automatic ZIP creation for multiple files
- ⏰ Automatic cleanup after 24 hours
- 📱 Responsive design with drag & drop support
- 🚀 Easy deployment to Render

## Local Development

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Clone or create the project directory:
```bash
mkdir file-upload-service
cd file-upload-service
```

2. Create the project structure:
```
file-upload-service/
├── server.js
├── package.json
├── public/
│   └── index.html
└── uploads/ (created automatically)
```

3. Install dependencies:
```bash
npm install
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and go to `http://localhost:3000`

## Deployment to Render

### Step 1: Prepare Your Code

1. Make sure all files are in your project directory
2. Initialize a Git repository (if not already done):
```bash
git init
git add .
git commit -m "Initial commit"
```

3. Push to GitHub, GitLab, or Bitbucket

### Step 2: Deploy on Render

1. Go to [Render.com](https://render.com) and sign up/login
2. Click "New +" and select "Web Service"
3. Connect your GitHub/GitLab/Bitbucket repository
4. Configure your service:
   - **Name**: `file-upload-service` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid for better performance)

5. Click "Create Web Service"

### Step 3: Environment Configuration

Render will automatically:
- Install dependencies using `npm install`
- Start your application using `npm start`
- Provide a public URL for your service

### Important Notes for Render Deployment

- **File Storage**: Files are stored temporarily in memory/disk. On Render's free tier, files will be lost when the service restarts (which happens regularly)
- **File Persistence**: For production use, consider integrating with cloud storage (AWS S3, Google Cloud Storage, etc.)
- **Memory Limits**: Be aware of Render's memory limits on free tier

## API Endpoints

### Upload Files
- **POST** `/upload`
- Accepts multipart/form-data with files
- Returns upload ID and download link

### Download Files
- **GET** `/download/:uploadId`
- Downloads single file or ZIP of multiple files

### Get Upload Info
- **GET** `/info/:uploadId`
- Returns metadata about uploaded files

## Project Structure

```
file-upload-service/
├── server.js              # Main Express server
├── package.json           # Dependencies and scripts
├── public/
│   └── index.html        # Frontend interface
├── uploads/              # Temporary file storage
└── README.md            # This file
```

## Configuration

### File Limits
- Maximum files per upload: 10
- Maximum file size: 50MB
- File retention: 24 hours

### Customization

You can modify these settings in `server.js`:

```javascript
// File upload limits
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // Change this for different file size limit
    }
});

// File retention (cleanup interval)
const maxAge = 24 * 60 * 60 * 1000; // Change this for different retention period
```

## Security Considerations

- Files are automatically deleted after 24 hours
- No authentication system (consider adding for production)
- File type restrictions can be added if needed
- Consider rate limiting for production use

## Troubleshooting

### Common Issues

1. **Port Error**: Make sure port 3000 is available or set a different PORT environment variable
2. **File Upload Fails**: Check file size limits and available disk space
3. **Downloads Not Working**: Ensure the uploads directory exists and has proper permissions

### Render-Specific Issues

1. **Service Won't Start**: Check the build and start commands in Render dashboard
2. **Files Disappear**: This is expected on free tier - consider upgrading or using cloud storage
3. **Slow Performance**: Free tier has limitations - consider paid plans for better performance

## Future Enhancements

- User authentication
- Cloud storage integration (AWS S3, Google Cloud)
- File encryption
- Password protection for downloads
- Download analytics
- Email notifications

## License

MIT License - feel free to use and modify as needed.