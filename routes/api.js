const express = require('express');
const { body, validationResult, query } = require('express-validator');
const ApiEndpoint = require('../models/ApiEndpoint');
const Product = require('../models/Product');

const router = express.Router();

// @route   GET /api/endpoints
// @desc    Get all API endpoints with filtering
// @access  Private
router.get('/endpoints', [
  query('product').optional().isMongoId().withMessage('Invalid product ID'),
  query('status').optional().isIn(['active', 'inactive', 'deprecated', 'beta', 'maintenance']),
  query('method').optional().isIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']),
  query('search').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { product, status, method, search, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (product) filter.product = product;
    if (status) filter.status = status;
    if (method) filter.method = method;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { path: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Get endpoints with pagination
    const endpoints = await ApiEndpoint.find(filter)
      .populate('product', 'name description')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await ApiEndpoint.countDocuments(filter);

    res.json({
      success: true,
      data: {
        endpoints,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Endpoints fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching endpoints'
    });
  }
});

// @route   POST /api/endpoints
// @desc    Create a new API endpoint
// @access  Private
router.post('/endpoints', [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('API name must be between 2 and 100 characters'),
  body('path').trim().notEmpty().withMessage('API path is required'),
  body('method').isIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']).withMessage('Invalid HTTP method'),
  body('product').isMongoId().withMessage('Valid product ID is required'),
  body('description').trim().isLength({ min: 10, max: 500 }).withMessage('Description must be between 10 and 500 characters'),
  body('baseUrl').trim().isURL().withMessage('Valid base URL is required'),
  body('version').optional().isString(),
  body('headers').optional().isArray(),
  body('parameters').optional().isArray(),
  body('requestBody').optional().isObject(),
  body('responseSchema').optional().isObject(),
  body('expectedStatusCodes').optional().isArray(),
  body('authentication').optional().isObject(),
  body('rateLimit').optional().isObject(),
  body('tags').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    // Check if product exists
    const product = await Product.findById(req.body.product);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Get user from middleware (you'll need to implement auth middleware)
    const userId = req.user?.id || req.body.createdBy; // Temporary for demo

    const endpointData = {
      ...req.body,
      createdBy: userId,
      fullUrl: `${req.body.baseUrl}${req.body.path}`
    };

    const endpoint = new ApiEndpoint(endpointData);
    await endpoint.save();

    // Update product metrics
    product.metrics.totalApis += 1;
    if (endpoint.status === 'active') {
      product.metrics.activeApis += 1;
    }
    await product.save();

    // Populate references
    await endpoint.populate('product', 'name description');
    await endpoint.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'API endpoint created successfully',
      data: {
        endpoint
      }
    });
  } catch (error) {
    console.error('Endpoint creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating endpoint'
    });
  }
});

// @route   GET /api/endpoints/:id
// @desc    Get API endpoint by ID
// @access  Private
router.get('/endpoints/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const endpoint = await ApiEndpoint.findById(id)
      .populate('product', 'name description')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!endpoint) {
      return res.status(404).json({
        success: false,
        message: 'API endpoint not found'
      });
    }

    res.json({
      success: true,
      data: {
        endpoint
      }
    });
  } catch (error) {
    console.error('Endpoint fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching endpoint'
    });
  }
});

// @route   PUT /api/endpoints/:id
// @desc    Update API endpoint
// @access  Private
router.put('/endpoints/:id', [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('API name must be between 2 and 100 characters'),
  body('path').optional().trim().notEmpty().withMessage('API path is required'),
  body('method').optional().isIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']).withMessage('Invalid HTTP method'),
  body('description').optional().trim().isLength({ min: 10, max: 500 }).withMessage('Description must be between 10 and 500 characters'),
  body('baseUrl').optional().trim().isURL().withMessage('Valid base URL is required'),
  body('status').optional().isIn(['active', 'inactive', 'deprecated', 'beta', 'maintenance']).withMessage('Invalid status'),
  body('version').optional().isString(),
  body('headers').optional().isArray(),
  body('parameters').optional().isArray(),
  body('requestBody').optional().isObject(),
  body('responseSchema').optional().isObject(),
  body('expectedStatusCodes').optional().isArray(),
  body('authentication').optional().isObject(),
  body('rateLimit').optional().isObject(),
  body('tags').optional().isArray(),
  body('documentation').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Get user from middleware (you'll need to implement auth middleware)
    const userId = req.user?.id || req.body.updatedBy; // Temporary for demo
    updateData.updatedBy = userId;

    // Update full URL if baseUrl or path changed
    if (updateData.baseUrl || updateData.path) {
      const currentEndpoint = await ApiEndpoint.findById(id);
      const newBaseUrl = updateData.baseUrl || currentEndpoint.baseUrl;
      const newPath = updateData.path || currentEndpoint.path;
      updateData.fullUrl = `${newBaseUrl}${newPath}`;
    }

    const endpoint = await ApiEndpoint.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('product', 'name description')
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

    if (!endpoint) {
      return res.status(404).json({
        success: false,
        message: 'API endpoint not found'
      });
    }

    res.json({
      success: true,
      message: 'API endpoint updated successfully',
      data: {
        endpoint
      }
    });
  } catch (error) {
    console.error('Endpoint update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating endpoint'
    });
  }
});

// @route   DELETE /api/endpoints/:id
// @desc    Delete API endpoint
// @access  Private
router.delete('/endpoints/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const endpoint = await ApiEndpoint.findById(id);
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        message: 'API endpoint not found'
      });
    }

    // Update product metrics
    const product = await Product.findById(endpoint.product);
    if (product) {
      product.metrics.totalApis -= 1;
      if (endpoint.status === 'active') {
        product.metrics.activeApis -= 1;
      }
      await product.save();
    }

    await ApiEndpoint.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'API endpoint deleted successfully'
    });
  } catch (error) {
    console.error('Endpoint deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting endpoint'
    });
  }
});

// @route   POST /api/endpoints/:id/test
// @desc    Test an API endpoint
// @access  Private
router.post('/endpoints/:id/test', [
  body('headers').optional().isObject(),
  body('queryParams').optional().isObject(),
  body('body').optional(),
  body('environment').optional().isIn(['development', 'staging', 'production'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { headers = {}, queryParams = {}, body: requestBody, environment = 'development' } = req.body;

    const endpoint = await ApiEndpoint.findById(id);
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        message: 'API endpoint not found'
      });
    }

    // Build URL with query parameters
    let url = endpoint.fullUrl;
    if (Object.keys(queryParams).length > 0) {
      const queryString = new URLSearchParams(queryParams).toString();
      url += `?${queryString}`;
    }

    // Prepare request options
    const requestOptions = {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    // Add body for POST, PUT, PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method) && requestBody) {
      requestOptions.body = JSON.stringify(requestBody);
    }

    const startTime = new Date();
    let response, responseBody, statusCode, statusText;

    try {
      // Make the actual HTTP request
      response = await fetch(url, requestOptions);
      statusCode = response.status;
      statusText = response.statusText;
      
      // Get response headers
      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Get response body
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }

    } catch (error) {
      // Handle network errors
      statusCode = 0;
      statusText = 'Network Error';
      responseBody = { error: error.message };
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    // Create API request record
    const ApiRequest = require('../models/ApiRequest');
    const { v4: uuidv4 } = require('uuid');

    const apiRequest = new ApiRequest({
      endpoint: endpoint._id,
      product: endpoint.product,
      requestId: uuidv4(),
      method: endpoint.method,
      url,
      baseUrl: endpoint.baseUrl,
      path: endpoint.path,
      headers: requestOptions.headers,
      queryParams,
      body: requestBody,
      response: {
        statusCode,
        statusText,
        headers: responseHeaders || {},
        body: responseBody,
        size: JSON.stringify(responseBody).length
      },
      timing: {
        startTime,
        endTime,
        duration
      },
      environment,
      source: 'manual'
    });

    await apiRequest.save();

    // Update endpoint metrics
    endpoint.metrics.totalRequests += 1;
    endpoint.metrics.lastRequestTime = new Date();
    
    if (statusCode >= 200 && statusCode < 300) {
      endpoint.metrics.successfulRequests += 1;
    } else if (statusCode >= 400) {
      endpoint.metrics.failedRequests += 1;
    }

    // Update average response time
    const currentAvg = endpoint.metrics.averageResponseTime;
    const totalRequests = endpoint.metrics.totalRequests;
    endpoint.metrics.averageResponseTime = Math.round(
      ((currentAvg * (totalRequests - 1)) + duration) / totalRequests
    );

    await endpoint.save();

    res.json({
      success: true,
      message: 'API test completed',
      data: {
        test: {
          url,
          method: endpoint.method,
          requestHeaders: requestOptions.headers,
          requestBody,
          response: {
            statusCode,
            statusText,
            headers: responseHeaders || {},
            body: responseBody
          },
          timing: {
            duration,
            startTime,
            endTime
          }
        },
        endpoint: {
          id: endpoint._id,
          name: endpoint.name,
          metrics: endpoint.metrics
        }
      }
    });
  } catch (error) {
    console.error('API test error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while testing endpoint'
    });
  }
});

// @route   GET /api/endpoints/:id/requests
// @desc    Get request history for an API endpoint
// @access  Private
router.get('/endpoints/:id/requests', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['success', 'error']),
  query('environment').optional().isIn(['development', 'staging', 'production'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { page = 1, limit = 10, status, environment } = req.query;
    const skip = (page - 1) * limit;

    // Check if endpoint exists
    const endpoint = await ApiEndpoint.findById(id);
    if (!endpoint) {
      return res.status(404).json({
        success: false,
        message: 'API endpoint not found'
      });
    }

    // Build filter
    const filter = { endpoint: id };
    if (status === 'success') {
      filter['response.statusCode'] = { $gte: 200, $lt: 300 };
    } else if (status === 'error') {
      filter['response.statusCode'] = { $gte: 400 };
    }
    if (environment) filter.environment = environment;

    // Import ApiRequest model
    const ApiRequest = require('../models/ApiRequest');

    // Get requests with pagination
    const requests = await ApiRequest.find(filter)
      .select('-response.body') // Exclude response body for performance
      .sort({ 'timing.startTime': -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await ApiRequest.countDocuments(filter);

    res.json({
      success: true,
      data: {
        endpoint: {
          id: endpoint._id,
          name: endpoint.name,
          path: endpoint.path,
          method: endpoint.method
        },
        requests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Endpoint requests fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching endpoint requests'
    });
  }
});

module.exports = router; 