const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  version: {
    type: String,
    default: '1.0.0'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'deprecated', 'beta'],
    default: 'active'
  },
  category: {
    type: String,
    required: [true, 'Product category is required'],
    enum: ['web', 'mobile', 'desktop', 'api', 'service', 'other']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  team: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  tags: [{
    type: String,
    trim: true
  }],
  documentation: {
    type: String,
    default: ''
  },
  repository: {
    type: String,
    default: ''
  },
  environment: {
    development: {
      type: String,
      default: ''
    },
    staging: {
      type: String,
      default: ''
    },
    production: {
      type: String,
      default: ''
    }
  },
  metrics: {
    totalApis: {
      type: Number,
      default: 0
    },
    activeApis: {
      type: Number,
      default: 0
    },
    totalRequests: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number,
      default: 0
    },
    successRate: {
      type: Number,
      default: 100
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for API count
productSchema.virtual('apiCount').get(function() {
  return this.metrics.totalApis;
});

// Index for better query performance
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ owner: 1, status: 1 });
productSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('Product', productSchema); 