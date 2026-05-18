const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coaching-feed';

mongoose.connect(MONGO_URI)
  .then(() => console.log('🟢 MongoDB connected successfully.'))
  .catch(err => {
    console.error('🔴 MongoDB connection error:', err);
    process.exit(1);
  });

const FeedSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    trim: true
  },
  coachName: {
    type: String,
    required: [true, 'Coach name is required'],
    trim: true
  },
  tag: {
    type: String,
    required: [true, 'Tag/Category is required'],
    enum: ['Strategy', 'Motivation', 'Tactics', 'Technical', 'Mindset'],
    default: 'Strategy'
  },
  colorTheme: {
    type: String,
    enum: ['purple', 'orange', 'cyan', 'green', 'pink'],
    default: 'purple'
  },
  claps: {
    type: Number,
    default: 0,
    min: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Virtual for friendly date formatting if needed
FeedSchema.set('toJSON', { virtuals: true });
FeedSchema.set('toObject', { virtuals: true });

const Feed = mongoose.model('Feed', FeedSchema);

module.exports = {
  mongoose,
  Feed
};
