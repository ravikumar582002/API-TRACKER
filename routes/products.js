const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Product = require('../models/Product');
const ApiEndpoint = require('../models/ApiEndpoint');

const router = express.Router();

// @route   GET /api/products
// @desc    Get all products with optional filtering
// @access  Private
router.get('/', [
  query('status').optional().isIn(['active', 'inactive', 'deprecated', 'beta']),
  query('category').optional().isIn(['web', 'mobile', 'desktop', 'api', 'service', 'other']),
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

    const { status, category, search, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (search) {
      filter.$text = { $search: search };
    }

    // Get products with pagination
    const products = await Product.find(filter)
      .populate('owner', 'name email')
      .populate('team', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Products fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching products'
    });
  }
});

// @route   POST /api/products
// @desc    Create a new product
// @access  Private
router.post('/', [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Product name must be between 2 and 100 characters'),
  body('description').trim().isLength({ min: 10, max: 500 }).withMessage('Description must be between 10 and 500 characters'),
  body('category').isIn(['web', 'mobile', 'desktop', 'api', 'service', 'other']).withMessage('Invalid category'),
  body('version').optional().isString(),
  body('tags').optional().isArray(),
  body('documentation').optional().isString(),
  body('repository').optional().isURL().withMessage('Invalid repository URL'),
  body('environment').optional().isObject()
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

    // Get user from middleware (you'll need to implement auth middleware)
    const userId = req.user?.id || req.body.owner; // Temporary for demo

    const productData = {
      ...req.body,
      owner: userId
    };

    const product = new Product(productData);
    await product.save();

    // Populate owner details
    await product.populate('owner', 'name email');

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        product
      }
    });
  } catch (error) {
    console.error('Product creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating product'
    });
  }
});

// @route   GET /api/products/:id
// @desc    Get product by ID with detailed information
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id)
      .populate('owner', 'name email')
      .populate('team', 'name email');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Get associated APIs
    const apis = await ApiEndpoint.find({ product: id })
      .select('name path method status metrics')
      .sort({ createdAt: -1 });

    // Calculate aggregated metrics
    const totalApis = apis.length;
    const activeApis = apis.filter(api => api.status === 'active').length;
    const totalRequests = apis.reduce((sum, api) => sum + api.metrics.totalRequests, 0);
    const avgResponseTime = apis.length > 0 
      ? apis.reduce((sum, api) => sum + api.metrics.averageResponseTime, 0) / apis.length 
      : 0;

    res.json({
      success: true,
      data: {
        product,
        apis,
        metrics: {
          totalApis,
          activeApis,
          totalRequests,
          averageResponseTime: Math.round(avgResponseTime)
        }
      }
    });
  } catch (error) {
    console.error('Product fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching product'
    });
  }
});

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private
router.put('/:id', [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Product name must be between 2 and 100 characters'),
  body('description').optional().trim().isLength({ min: 10, max: 500 }).withMessage('Description must be between 10 and 500 characters'),
  body('status').optional().isIn(['active', 'inactive', 'deprecated', 'beta']).withMessage('Invalid status'),
  body('category').optional().isIn(['web', 'mobile', 'desktop', 'api', 'service', 'other']).withMessage('Invalid category'),
  body('version').optional().isString(),
  body('tags').optional().isArray(),
  body('documentation').optional().isString(),
  body('repository').optional().isURL().withMessage('Invalid repository URL'),
  body('environment').optional().isObject()
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

    const product = await Product.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('owner', 'name email');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: {
        product
      }
    });
  } catch (error) {
    console.error('Product update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating product'
    });
  }
});

// @route   DELETE /api/products/:id
// @desc    Delete product
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if product has associated APIs
    const apiCount = await ApiEndpoint.countDocuments({ product: id });
    if (apiCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete product with ${apiCount} associated APIs. Please remove APIs first.`
      });
    }

    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Product deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting product'
    });
  }
});

// @route   GET /api/products/:id/apis
// @desc    Get all APIs for a specific product
// @access  Private
router.get('/:id/apis', [
  query('status').optional().isIn(['active', 'inactive', 'deprecated', 'beta', 'maintenance']),
  query('method').optional().isIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']),
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

    const { id } = req.params;
    const { status, method, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Check if product exists
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Build filter
    const filter = { product: id };
    if (status) filter.status = status;
    if (method) filter.method = method;

    // Get APIs with pagination
    const apis = await ApiEndpoint.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await ApiEndpoint.countDocuments(filter);

    res.json({
      success: true,
      data: {
        product: {
          id: product._id,
          name: product.name,
          description: product.description
        },
        apis,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Product APIs fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching product APIs'
    });
  }
});

// @route   GET /api/products/:id/metrics
// @desc    Get detailed metrics for a product
// @access  Private
router.get('/:id/metrics', [
  query('period').optional().isIn(['1h', '24h', '7d', '30d', 'all']).withMessage('Invalid period'),
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
    const { period = '7d', environment } = req.query;

    // Check if product exists
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Calculate date range based on period
    let startDate = new Date();
    switch (period) {
      case '1h':
        startDate.setHours(startDate.getHours() - 1);
        break;
      case '24h':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'all':
        startDate = new Date(0);
        break;
    }

    // Get APIs for this product
    const apis = await ApiEndpoint.find({ product: id });
    const apiIds = apis.map(api => api._id);

    // Import ApiRequest model for metrics calculation
    const ApiRequest = require('../models/ApiRequest');

    // Build filter for requests
    const requestFilter = {
      product: id,
      'timing.startTime': { $gte: startDate }
    };
    if (environment) requestFilter.environment = environment;

    // Get aggregated metrics
    const metrics = await ApiRequest.aggregate([
      { $match: requestFilter },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          successfulRequests: {
            $sum: {
              $cond: [
                { $and: [
                  { $gte: ['$response.statusCode', 200] },
                  { $lt: ['$response.statusCode', 300] }
                ]},
                1,
                0
              ]
            }
          },
          failedRequests: {
            $sum: {
              $cond: [
                { $gte: ['$response.statusCode', 400] },
                1,
                0
              ]
            }
          },
          averageResponseTime: { $avg: '$timing.duration' },
          minResponseTime: { $min: '$timing.duration' },
          maxResponseTime: { $max: '$timing.duration' }
        }
      }
    ]);

    // Get status code distribution
    const statusCodes = await ApiRequest.aggregate([
      { $match: requestFilter },
      {
        $group: {
          _id: '$response.statusCode',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get requests by hour (for charts)
    const requestsByHour = await ApiRequest.aggregate([
      { $match: requestFilter },
      {
        $group: {
          _id: {
            year: { $year: '$timing.startTime' },
            month: { $month: '$timing.startTime' },
            day: { $dayOfMonth: '$timing.startTime' },
            hour: { $hour: '$timing.startTime' }
          },
          count: { $sum: 1 },
          avgResponseTime: { $avg: '$timing.duration' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
    ]);

    const result = {
      product: {
        id: product._id,
        name: product.name,
        description: product.description
      },
      period,
      environment: environment || 'all',
      summary: metrics[0] || {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0
      },
      apis: {
        total: apis.length,
        active: apis.filter(api => api.status === 'active').length,
        inactive: apis.filter(api => api.status === 'inactive').length,
        deprecated: apis.filter(api => api.status === 'deprecated').length
      },
      statusCodes,
      requestsByHour: requestsByHour.map(item => ({
        timestamp: new Date(item._id.year, item._id.month - 1, item._id.day, item._id.hour),
        count: item.count,
        avgResponseTime: Math.round(item.avgResponseTime)
      }))
    };

    // Calculate success rate
    if (result.summary.totalRequests > 0) {
      result.summary.successRate = Math.round((result.summary.successfulRequests / result.summary.totalRequests) * 100);
    } else {
      result.summary.successRate = 100;
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Product metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching product metrics'
    });
  }
});

module.exports = router; 