const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const archiver = require('archiver');
const { GridFSBucket } = require('mongodb');

const app = express();
const PORT = 5432;

const MONGODB_URI = 'mongodb+srv://helodr:helodr@cluster0.l0mrggc.mongodb.net/fileupload?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 'fileupload';
const COLLECTION_NAME = 'uploads';

let gfs, uploadsCollection;

app.use(express.json());

// Connect to MongoDB
mongoose.connect(MONGODB_URI);
const conn = mongoose.connection;

conn.once('open', async () => {
  console.log('MongoDB connected via Mongoose');

  // Initialize GridFS Bucket
  gfs = new GridFSBucket(conn.db, {
    bucketName: 'uploads'
  });

  // Get collection reference
  uploadsCollection = conn.db.collection(COLLECTION_NAME);

  // Create TTL index
  await uploadsCollection.createIndex({ uploadDate: 1 }, { expireAfterSeconds: 86400 });

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
});

// Custom storage engine for multer
const storage = multer.diskStorage({
  filename: (req, file, cb) => {
    crypto.randomBytes(16, (err, buf) => {
      if (err) return cb(err);
      const filename = buf.toString('hex') + path.extname(file.originalname);
      cb(null, filename);
    });
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Error handling
conn.on('error', err => {
  console.error('MongoDB connection error:', err);
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});

// Routes
// Serve the main HTML page
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    const uploadId = crypto.randomUUID();
    const files = [];

    // Process each file and store in GridFS
    for (const file of req.files) {
      const readStream = require('fs').createReadStream(file.path);
      const uploadStream = gfs.openUploadStream(file.filename, {
        metadata: {
          originalName: file.originalname,
          mimetype: file.mimetype
        }
      });

      const fileInfo = await new Promise((resolve, reject) => {
        readStream.pipe(uploadStream)
          .on('error', reject)
          .on('finish', () => {
            resolve({
              originalName: file.originalname,
              storageName: file.filename,
              mimetype: file.mimetype,
              size: file.size,
              fileId: uploadStream.id
            });
          });
      });

      files.push(fileInfo);
      require('fs').unlinkSync(file.path); // Remove temp file
    }

    await uploadsCollection.insertOne({
      id: uploadId,
      files,
      uploadDate: new Date(),
      downloadCount: 0
    });

    res.json({
      success: true,
      uploadId,
      downloadLink: `/download/${uploadId}`,
      files: files.map(f => ({ name: f.originalName, size: f.size }))
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/download/:uploadId', async (req, res) => {
  try {
    const upload = await uploadsCollection.findOne({ 
      id: req.params.uploadId 
    });
    
    if (!upload) {
      return res.status(404).send('Upload not found');
    }

    await uploadsCollection.updateOne(
      { id: upload.id },
      { $inc: { downloadCount: 1 } }
    );

    if (upload.files.length === 1) {
      const file = upload.files[0];
      const downloadStream = gfs.openDownloadStream(file.fileId);
      
      downloadStream.on('error', () => {
        res.status(404).send('File not found');
      });

      res.set({
        'Content-Type': file.mimetype,
        'Content-Disposition': `attachment; filename="${file.originalName}"`
      });
      
      downloadStream.pipe(res);
    } else {
      const zip = archiver('zip');
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="files_${upload.id}.zip"`
      });
      
      zip.pipe(res);
      
      for (const file of upload.files) {
        const downloadStream = gfs.openDownloadStream(file.fileId);
        zip.append(downloadStream, { name: file.originalName });
      }
      
      await zip.finalize();
    }
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).send('Download failed');
  }
});

// Keep the /info and /admin/uploads routes from previous example

app.get('/info/:uploadId', async (req, res) => {
  try {
    const upload = await uploadsCollection.findOne({ 
      id: req.params.uploadId 
    });
    
    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    res.json({
      id: upload.id,
      files: upload.files.map(f => ({
        name: f.originalName,
        size: f.size,
        type: f.mimetype
      })),
      uploadDate: upload.uploadDate,
      downloadCount: upload.downloadCount
    });
  } catch (error) {
    console.error('Info error:', error);
    res.status(500).json({ error: 'Info retrieval failed' });
  }
});

app.get('/admin/uploads', async (req, res) => {
  try {
    const uploads = await uploadsCollection.find()
      .sort({ uploadDate: -1 })
      .toArray();
    
    res.json(uploads);
  } catch (error) {
    console.error('Admin error:', error);
    res.status(500).json({ error: 'Failed to retrieve uploads' });
  }
});