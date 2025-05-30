const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 5432;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, uploadsDir);
	},
	filename: (req, file, cb) => {
		const uniqueId = uuidv4();
		const ext = path.extname(file.originalname);
		const name = path.basename(file.originalname, ext);
		cb(null, `${uniqueId}_${name}${ext}`);
	}
});

const upload = multer({
	storage: storage,
	limits: {
		fileSize: 50 * 1024 * 1024 // 50MB limit
	}
});

// Store file metadata
const fileStore = new Map();

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Serve the main HTML page
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle file uploads
app.post('/upload', upload.array('files', 10), (req, res) => {
	try {
		if (!req.files || req.files.length === 0) {
			return res.status(400).json({ error: 'No files uploaded' });
		}

		const uploadId = uuidv4();
		const uploadData = {
			id: uploadId,
			files: req.files.map(file => ({
				originalName: file.originalname,
				filename: file.filename,
				size: file.size,
				mimetype: file.mimetype
			})),
			uploadDate: new Date(),
			downloadCount: 0
		};

		fileStore.set(uploadId, uploadData);

		const downloadLink = `/download/${uploadId}`;

		res.json({
			success: true,
			uploadId: uploadId,
			downloadLink: downloadLink,
			files: uploadData.files.map(f => ({
				name: f.originalName,
				size: f.size
			}))
		});
	} catch (error) {
		console.error('Upload error:', error);
		res.status(500).json({ error: 'Upload failed' });
	}
});

// Handle file downloads
app.get('/download/:uploadId', (req, res) => {
	const uploadId = req.params.uploadId;
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = 5432;

// MongoDB configuration
const MONGODB_URI = 'mongodb://epaper@cluster0.2uuglui.mongodb.net';
const DB_NAME = 'fileupload';
const COLLECTION_NAME = 'uploads';

let db;
let uploadsCollection;

// Initialize MongoDB connection
async function initMongoDB() {
	try {
		const client = new MongoClient(MONGODB_URI);
		await client.connect();
		db = client.db(DB_NAME);
		uploadsCollection = db.collection(COLLECTION_NAME);
		console.log('Connected to MongoDB successfully');
		
		// Create index for uploadId for faster queries
		await uploadsCollection.createIndex({ id: 1 });
		
		// Create TTL index for automatic cleanup after 24 hours
		await uploadsCollection.createIndex({ uploadDate: 1 }, { expireAfterSeconds: 86400 });
		
	} catch (error) {
		console.error('MongoDB connection error:', error);
		process.exit(1);
	}
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, uploadsDir);
	},
	filename: (req, file, cb) => {
		const uniqueId = uuidv4();
		const ext = path.extname(file.originalname);
		const name = path.basename(file.originalname, ext);
		cb(null, `${uniqueId}_${name}${ext}`);
	}
});

const upload = multer({
	storage: storage,
	limits: {
		fileSize: 50 * 1024 * 1024 // 50MB limit
	}
});

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Serve the main HTML page
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle file uploads
app.post('/upload', upload.array('files', 10), async (req, res) => {
	try {
		if (!req.files || req.files.length === 0) {
			return res.status(400).json({ error: 'No files uploaded' });
		}

		const uploadId = uuidv4();
		const uploadData = {
			id: uploadId,
			files: req.files.map(file => ({
				originalName: file.originalname,
				filename: file.filename,
				size: file.size,
				mimetype: file.mimetype
			})),
			uploadDate: new Date(),
			downloadCount: 0
		};

		// Store in MongoDB
		await uploadsCollection.insertOne(uploadData);

		const downloadLink = `/download/${uploadId}`;

		res.json({
			success: true,
			uploadId: uploadId,
			downloadLink: downloadLink,
			files: uploadData.files.map(f => ({
				name: f.originalName,
				size: f.size
			}))
		});
	} catch (error) {
		console.error('Upload error:', error);
		res.status(500).json({ error: 'Upload failed' });
	}
});

// Handle file downloads
app.get('/download/:uploadId', async (req, res) => {
	const uploadId = req.params.uploadId;
	
	try {
		const uploadData = await uploadsCollection.findOne({ id: uploadId });

		if (!uploadData) {
			return res.status(404).send('Files not found or expired');
		}

		// If single file, send it directly
		if (uploadData.files.length === 1) {
			const file = uploadData.files[0];
			const filePath = path.join(uploadsDir, file.filename);

			if (!fs.existsSync(filePath)) {
				return res.status(404).send('File not found');
			}

			// Update download count in MongoDB
			await uploadsCollection.updateOne(
				{ id: uploadId },
				{ $inc: { downloadCount: 1 } }
			);

			res.download(filePath, file.originalName);
		} else {
			// Multiple files - create zip
			const zipName = `files_${uploadId}.zip`;

			res.setHeader('Content-Type', 'application/zip');
			res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

			const archive = archiver('zip', {
				zlib: { level: 9 }
			});

			archive.on('error', (err) => {
				console.error('Archive error:', err);
				res.status(500).send('Error creating zip file');
			});

			archive.pipe(res);

			// Add files to zip
			uploadData.files.forEach(file => {
				const filePath = path.join(uploadsDir, file.filename);
				if (fs.existsSync(filePath)) {
					archive.file(filePath, { name: file.originalName });
				}
			});

			// Update download count in MongoDB
			await uploadsCollection.updateOne(
				{ id: uploadId },
				{ $inc: { downloadCount: 1 } }
			);

			archive.finalize();
		}
	} catch (error) {
		console.error('Download error:', error);
		res.status(500).send('Download failed');
	}
});

// Get upload info
app.get('/info/:uploadId', async (req, res) => {
	const uploadId = req.params.uploadId;
	
	try {
		const uploadData = await uploadsCollection.findOne({ id: uploadId });

		if (!uploadData) {
			return res.status(404).json({ error: 'Upload not found' });
		}

		res.json({
			id: uploadData.id,
			files: uploadData.files.map(f => ({
				name: f.originalName,
				size: f.size,
				type: f.mimetype
			})),
			uploadDate: uploadData.uploadDate,
			downloadCount: uploadData.downloadCount
		});
	} catch (error) {
		console.error('Info retrieval error:', error);
		res.status(500).json({ error: 'Failed to retrieve upload info' });
	}
});

// Manual cleanup endpoint (optional - MongoDB TTL will handle automatic cleanup)
app.delete('/cleanup', async (req, res) => {
	try {
		const now = new Date();
		const maxAge = 24 * 60 * 60 * 1000; // 24 hours
		const cutoffDate = new Date(now.getTime() - maxAge);

		// Find expired uploads
		const expiredUploads = await uploadsCollection.find({
			uploadDate: { $lt: cutoffDate }
		}).toArray();

		// Delete associated files
		for (const upload of expiredUploads) {
			upload.files.forEach(file => {
				const filePath = path.join(uploadsDir, file.filename);
				if (fs.existsSync(filePath)) {
					fs.unlinkSync(filePath);
				}
			});
		}

		// Remove from MongoDB
		const deleteResult = await uploadsCollection.deleteMany({
			uploadDate: { $lt: cutoffDate }
		});

		res.json({
			success: true,
			deletedCount: deleteResult.deletedCount,
			message: `Cleaned up ${deleteResult.deletedCount} expired uploads`
		});
	} catch (error) {
		console.error('Cleanup error:', error);
		res.status(500).json({ error: 'Cleanup failed' });
	}
});

// Get all uploads (for admin purposes)
app.get('/admin/uploads', async (req, res) => {
	try {
		const uploads = await uploadsCollection.find({}).sort({ uploadDate: -1 }).toArray();
		res.json(uploads);
	} catch (error) {
		console.error('Admin uploads retrieval error:', error);
		res.status(500).json({ error: 'Failed to retrieve uploads' });
	}
});

// Initialize MongoDB and start server
initMongoDB().then(() => {
	app.listen(PORT, () => {
		console.log(`Server running on port ${PORT}`);
		console.log(`Access the application at http://localhost:${PORT}`);
	});
}).catch(error => {
	console.error('Failed to initialize application:', error);
	process.exit(1);
});
