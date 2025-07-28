const mongoose = require('mongoose');

const apiRequestSchema = new mongoose.Schema({
  endpoint: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ApiEndpoint',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  requestId: {
    type: String,
    required: true,
    unique: true
  },
  method: {
    type: String,
    required: true,
    uppercase: true
  },
  url: {
    type: String,
    required: true
  },
  baseUrl: {
    type: String,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  headers: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  queryParams: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  body: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  response: {
    statusCode: {
      type: Number,
      required: true
    },
    statusText: {
      type: String,
      required: true
    },
    headers: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    body: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    size: {
      type: Number,
      default: 0
    }
  },
  timing: {
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date,
      required: true
    },
    duration: {
      type: Number,
      required: true // in milliseconds
    }
  },
  performance: {
    dnsLookup: {
      type: Number,
      default: 0
    },
    tcpConnection: {
      type: Number,
      default: 0
    },
    tlsHandshake: {
      type: Number,
      default: 0
    },
    firstByte: {
      type: Number,
      default: 0
    },
    contentDownload: {
      type: Number,
      default: 0
    }
  },
  error: {
    occurred: {
      type: Boolean,
      default: false
    },
    message: {
      type: String,
      default: null
    },
    code: {
      type: String,
      default: null
    },
    stack: {
      type: String,
      default: null
    }
  },
  metadata: {
    userAgent: {
      type: String,
      default: null
    },
    ipAddress: {
      type: String,
      default: null
    },
    referer: {
      type: String,
      default: null
    },
    origin: {
      type: String,
      default: null
    },
    contentType: {
      type: String,
      default: null
    },
    acceptLanguage: {
      type: String,
      default: null
    }
  },
  tags: [{
    type: String,
    trim: true
  }],
  environment: {
    type: String,
    enum: ['development', 'staging', 'production'],
    default: 'development'
  },
  source: {
    type: String,
    enum: ['manual', 'automated', 'monitoring', 'load-test'],
    default: 'manual'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  sessionId: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for success status
apiRequestSchema.virtual('isSuccess').get(function() {
  return this.response.statusCode >= 200 && this.response.statusCode < 300;
});

// Virtual for error status
apiRequestSchema.virtual('isError').get(function() {
  return this.response.statusCode >= 400;
});

// Virtual for response time category
apiRequestSchema.virtual('responseTimeCategory').get(function() {
  const duration = this.timing.duration;
  if (duration < 100) return 'fast';
  if (duration < 500) return 'normal';
  if (duration < 1000) return 'slow';
  return 'very-slow';
});

// Indexes for better query performance
apiRequestSchema.index({ endpoint: 1, 'timing.startTime': -1 });
apiRequestSchema.index({ product: 1, 'timing.startTime': -1 });
apiRequestSchema.index({ 'response.statusCode': 1, 'timing.startTime': -1 });
apiRequestSchema.index({ 'timing.startTime': -1 });
apiRequestSchema.index({ requestId: 1 });
apiRequestSchema.index({ 'error.occurred': 1, 'timing.startTime': -1 });
apiRequestSchema.index({ environment: 1, 'timing.startTime': -1 });

// TTL index to automatically delete old records (keep for 90 days)
apiRequestSchema.index({ 'timing.startTime': 1 }, { expireAfterSeconds: 7776000 });

// Pre-save middleware to calculate duration
apiRequestSchema.pre('save', function(next) {
  if (this.timing.startTime && this.timing.endTime) {
    this.timing.duration = this.timing.endTime.getTime() - this.timing.startTime.getTime();
  }
  next();
});

module.exports = mongoose.model('ApiRequest', apiRequestSchema); 