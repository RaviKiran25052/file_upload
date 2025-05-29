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
	const uploadData = fileStore.get(uploadId);

	if (!uploadData) {
		return res.status(404).send('Files not found or expired');
	}

	try {
		// If single file, send it directly
		if (uploadData.files.length === 1) {
			const file = uploadData.files[0];
			const filePath = path.join(uploadsDir, file.filename);

			if (!fs.existsSync(filePath)) {
				return res.status(404).send('File not found');
			}

			uploadData.downloadCount++;
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

			uploadData.downloadCount++;
			archive.finalize();
		}
	} catch (error) {
		console.error('Download error:', error);
		res.status(500).send('Download failed');
	}
});

// Get upload info
app.get('/info/:uploadId', (req, res) => {
	const uploadId = req.params.uploadId;
	const uploadData = fileStore.get(uploadId);

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
});

// Cleanup old files (run every hour)
setInterval(() => {
	const now = new Date();
	const maxAge = 24 * 60 * 60 * 1000; // 24 hours

	for (const [uploadId, uploadData] of fileStore.entries()) {
		if (now - uploadData.uploadDate > maxAge) {
			// Delete files
			uploadData.files.forEach(file => {
				const filePath = path.join(uploadsDir, file.filename);
				if (fs.existsSync(filePath)) {
					fs.unlinkSync(filePath);
				}
			});

			// Remove from store
			fileStore.delete(uploadId);
			console.log(`Cleaned up expired upload: ${uploadId}`);
		}
	}
}, 60 * 60 * 1000); // Run every hour

app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
	console.log(`Access the application at http://localhost:${PORT}`);
});