const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize database and models
const { Feed } = require('./db');

// Initialize redis client provider
const redisProvider = require('./redis');

const app = express();
const server = http.createServer(app);

// Configure CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'https://propulse-fruntend.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('vercel.app')) {
      return callback(null, true);
    }

    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

const CACHE_KEY = 'feed:all';

app.get('/', (req, res) => {
  res.send('Coaching Feed Backend is running! Access the frontend at http://localhost:3000');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date(),
    redis: redisProvider.isMock() ? 'InMemoryFallback' : 'RealRedis'
  });
});

app.get('/feed', async (req, res) => {
  try {
    const redisClient = redisProvider.getRedisClient();

    // Check if redisClient is initialized yet
    if (!redisClient) {
      console.log('💾 [API] Cache client starting up. Fetching directly from MongoDB...');
      const feeds = await Feed.find().sort({ createdAt: -1 });
      return res.json({
        success: true,
        fromCache: false,
        isRedis: false,
        data: feeds
      });
    }

    const isMock = redisProvider.isMock();

    // Check Cache
    const cachedData = await redisClient.get(CACHE_KEY);
    if (cachedData) {
      console.log(`⚡ [API] Cache HIT for "${CACHE_KEY}" (${isMock ? 'In-Memory 💾' : 'Redis ⚡'})`);
      return res.json({
        success: true,
        fromCache: true,
        isRedis: !isMock,
        data: JSON.parse(cachedData)
      });
    }

    console.log(`💾 [API] Cache MISS for "${CACHE_KEY}". Fetching from MongoDB...`);
    const feeds = await Feed.find().sort({ createdAt: -1 });

    // Store in Cache (Expires in 60 seconds)
    await redisClient.set(CACHE_KEY, JSON.stringify(feeds), { EX: 60 });
    console.log(`💾 [API] Cached ${feeds.length} feeds under "${CACHE_KEY}" (EX: 60s)`);

    res.json({
      success: true,
      fromCache: false,
      isRedis: !isMock,
      data: feeds
    });
  } catch (error) {
    console.error('🔴 GET /feed Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve coaching feed.',
      error: error.message
    });
  }
});

// 2. POST /feed - Create new coaching feed and update realtime clients
app.post('/feed', async (req, res) => {
  try {
    const { title, content, coachName, tag, colorTheme } = req.body;

    // Simple Validation
    if (!title || !content || !coachName || !tag) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: title, content, coachName, tag'
      });
    }

    // Save to Database
    const newFeed = new Feed({
      title,
      content,
      coachName,
      tag,
      colorTheme: colorTheme || 'purple'
    });

    await newFeed.save();
    console.log(`🟢 [API] Created new feed item ID: ${newFeed._id}`);

    // Invalidate Redis/In-Memory Cache
    const redisClient = redisProvider.getRedisClient();
    if (redisClient) {
      await redisClient.del(CACHE_KEY);
      console.log(`🗑️ [API] Invalidated cache key "${CACHE_KEY}" (Cache-Aside Write-Through)`);
    }

    // Broadcast Realtime Event to all clients via Socket.IO
    io.emit('feed:new', newFeed);
    console.log(`📡 [WS] Broadcasted "feed:new" event for item ID: ${newFeed._id}`);

    res.status(201).json({
      success: true,
      message: 'Coaching feed entry published successfully.',
      data: newFeed
    });
  } catch (error) {
    console.error('🔴 POST /feed Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create coaching feed entry.',
      error: error.message
    });
  }
});

// 3. POST /feed/:id/clap - Increment claps in realtime
app.post('/feed/:id/clap', async (req, res) => {
  try {
    const { id } = req.params;

    const updatedFeed = await Feed.findByIdAndUpdate(
      id,
      { $inc: { claps: 1 } },
      { new: true }
    );

    if (!updatedFeed) {
      return res.status(404).json({
        success: false,
        message: 'Coaching feed entry not found.'
      });
    }

    console.log(`👏 [API] Incremented claps for feed ID: ${id} to ${updatedFeed.claps}`);

    // Invalidate Cache
    const redisClient = redisProvider.getRedisClient();
    if (redisClient) {
      await redisClient.del(CACHE_KEY);
      console.log(`🗑️ [API] Invalidated cache key "${CACHE_KEY}" on clap`);
    }

    // Broadcast Realtime Clap Event
    io.emit('feed:clap', {
      id: updatedFeed._id,
      claps: updatedFeed.claps
    });
    console.log(`📡 [WS] Broadcasted "feed:clap" for ID: ${id} (${updatedFeed.claps} claps)`);

    res.json({
      success: true,
      data: {
        id: updatedFeed._id,
        claps: updatedFeed.claps
      }
    });
  } catch (error) {
    console.error('🔴 POST /feed/:id/clap Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record clap.',
      error: error.message
    });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔌 [WS] Client connected. Socket ID: ${socket.id}`);

  // Prevent duplicate socket actions / handle custom heartbeats if necessary
  socket.on('disconnect', (reason) => {
    console.log(`❌ [WS] Client disconnected. Socket ID: ${socket.id}. Reason: ${reason}`);
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 [Backend] Server listening on port ${PORT}...`);
});
