const mongoose = require('mongoose');

const apiEndpointSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'API endpoint name is required'],
    trim: true,
    maxlength: [100, 'API name cannot exceed 100 characters']
  },
  path: {
    type: String,
    required: [true, 'API path is required'],
    trim: true
  },
  method: {
    type: String,
    required: [true, 'HTTP method is required'],
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    uppercase: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  description: {
    type: String,
    required: [true, 'API description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'deprecated', 'beta', 'maintenance'],
    default: 'active'
  },
  version: {
    type: String,
    default: '1.0.0'
  },
  baseUrl: {
    type: String,
    required: [true, 'Base URL is required'],
    trim: true
  },
  fullUrl: {
    type: String,
    required: [true, 'Full URL is required'],
    trim: true
  },
  headers: [{
    name: {
      type: String,
      required: true
    },
    value: {
      type: String,
      required: true
    },
    required: {
      type: Boolean,
      default: false
    }
  }],
  parameters: [{
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['string', 'number', 'boolean', 'array', 'object'],
      default: 'string'
    },
    required: {
      type: Boolean,
      default: false
    },
    description: String,
    defaultValue: String
  }],
  requestBody: {
    type: {
      type: String,
      enum: ['json', 'form-data', 'x-www-form-urlencoded', 'raw'],
      default: 'json'
    },
    schema: {
      type: mongoose.Schema.Types.Mixed
    },
    example: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  responseSchema: {
    success: {
      type: mongoose.Schema.Types.Mixed
    },
    error: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  expectedStatusCodes: [{
    code: {
      type: Number,
      required: true
    },
    description: String
  }],
  authentication: {
    type: {
      type: String,
      enum: ['none', 'bearer', 'api-key', 'basic', 'oauth2'],
      default: 'none'
    },
    required: {
      type: Boolean,
      default: false
    }
  },
  rateLimit: {
    enabled: {
      type: Boolean,
      default: false
    },
    requests: {
      type: Number,
      default: 100
    },
    window: {
      type: Number,
      default: 900000 // 15 minutes in milliseconds
    }
  },
  metrics: {
    totalRequests: {
      type: Number,
      default: 0
    },
    successfulRequests: {
      type: Number,
      default: 0
    },
    failedRequests: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number,
      default: 0
    },
    lastRequestTime: {
      type: Date
    },
    uptime: {
      type: Number,
      default: 100
    }
  },
  tags: [{
    type: String,
    trim: true
  }],
  documentation: {
    type: String,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for success rate
apiEndpointSchema.virtual('successRate').get(function() {
  if (this.metrics.totalRequests === 0) return 100;
  return Math.round((this.metrics.successfulRequests / this.metrics.totalRequests) * 100);
});

// Virtual for full endpoint URL
apiEndpointSchema.virtual('endpointUrl').get(function() {
  return `${this.baseUrl}${this.path}`;
});

// Indexes for better query performance
apiEndpointSchema.index({ product: 1, status: 1 });
apiEndpointSchema.index({ method: 1, path: 1 });
apiEndpointSchema.index({ 'metrics.lastRequestTime': -1 });
apiEndpointSchema.index({ tags: 1 });

// Pre-save middleware to update full URL
apiEndpointSchema.pre('save', function(next) {
  this.fullUrl = `${this.baseUrl}${this.path}`;
  next();
});

module.exports = mongoose.model('ApiEndpoint', apiEndpointSchema); 