const express = require('express');
const { query, validationResult } = require('express-validator');
const ApiRequest = require('../models/ApiRequest');
const ApiEndpoint = require('../models/ApiEndpoint');
const Product = require('../models/Product');

const router = express.Router();

// @route   GET /api/tracking/dashboard
// @desc    Get dashboard overview with key metrics
// @access  Private
router.get('/dashboard', [
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

    const { period = '24h', environment } = req.query;

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

    // Build filter
    const filter = {
      'timing.startTime': { $gte: startDate }
    };
    if (environment) filter.environment = environment;

    // Get overall metrics
    const overallMetrics = await ApiRequest.aggregate([
      { $match: filter },
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
          maxResponseTime: { $max: '$timing.duration' },
          totalDataTransferred: { $sum: '$response.size' }
        }
      }
    ]);

    // Get requests by method
    const requestsByMethod = await ApiRequest.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$method',
          count: { $sum: 1 },
          avgResponseTime: { $avg: '$timing.duration' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get requests by status code
    const requestsByStatus = await ApiRequest.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$response.statusCode',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get top products by request count
    const topProducts = await ApiRequest.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$product',
          requestCount: { $sum: 1 },
          avgResponseTime: { $avg: '$timing.duration' },
          successRate: {
            $avg: {
              $cond: [
                { $and: [
                  { $gte: ['$response.statusCode', 200] },
                  { $lt: ['$response.statusCode', 300] }
                ]},
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { requestCount: -1 } },
      { $limit: 10 }
    ]);

    // Populate product details
    const productIds = topProducts.map(item => item._id);
    const products = await Product.find({ _id: { $in: productIds } }).select('name description');
    const productMap = {};
    products.forEach(product => {
      productMap[product._id.toString()] = product;
    });

    // Get requests by hour for the last 24 hours
    const requestsByHour = await ApiRequest.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: '$timing.startTime' },
            month: { $month: '$timing.startTime' },
            day: { $dayOfMonth: '$timing.startTime' },
            hour: { $hour: '$timing.startTime' }
          },
          count: { $sum: 1 },
          avgResponseTime: { $avg: '$timing.duration' },
          successCount: {
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
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
    ]);

    // Get recent errors
    const recentErrors = await ApiRequest.find({
      ...filter,
      'response.statusCode': { $gte: 400 }
    })
    .populate('endpoint', 'name path method')
    .populate('product', 'name')
    .select('response.statusCode response.statusText timing.startTime endpoint product')
    .sort({ 'timing.startTime': -1 })
    .limit(10);

    const result = {
      period,
      environment: environment || 'all',
      overview: overallMetrics[0] || {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        totalDataTransferred: 0
      },
      requestsByMethod,
      requestsByStatus,
      topProducts: topProducts.map(item => ({
        ...item,
        product: productMap[item._id.toString()] || { name: 'Unknown Product' },
        successRate: Math.round(item.successRate * 100)
      })),
      requestsByHour: requestsByHour.map(item => ({
        timestamp: new Date(item._id.year, item._id.month - 1, item._id.day, item._id.hour),
        count: item.count,
        avgResponseTime: Math.round(item.avgResponseTime),
        successRate: Math.round((item.successCount / item.count) * 100)
      })),
      recentErrors
    };

    // Calculate success rate
    if (result.overview.totalRequests > 0) {
      result.overview.successRate = Math.round((result.overview.successfulRequests / result.overview.totalRequests) * 100);
    } else {
      result.overview.successRate = 100;
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Dashboard fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard data'
    });
  }
});

// @route   GET /api/tracking/requests
// @desc    Get all API requests with filtering and pagination
// @access  Private
router.get('/requests', [
  query('product').optional().isMongoId().withMessage('Invalid product ID'),
  query('endpoint').optional().isMongoId().withMessage('Invalid endpoint ID'),
  query('method').optional().isIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']),
  query('status').optional().isIn(['success', 'error', 'client-error', 'server-error']),
  query('environment').optional().isIn(['development', 'staging', 'production']),
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date'),
  query('minDuration').optional().isInt({ min: 0 }).withMessage('Invalid min duration'),
  query('maxDuration').optional().isInt({ min: 0 }).withMessage('Invalid max duration'),
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

    const {
      product,
      endpoint,
      method,
      status,
      environment,
      startDate,
      endDate,
      minDuration,
      maxDuration,
      page = 1,
      limit = 20
    } = req.query;

    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (product) filter.product = product;
    if (endpoint) filter.endpoint = endpoint;
    if (method) filter.method = method;
    if (environment) filter.environment = environment;

    // Date range filter
    if (startDate || endDate) {
      filter['timing.startTime'] = {};
      if (startDate) filter['timing.startTime'].$gte = new Date(startDate);
      if (endDate) filter['timing.startTime'].$lte = new Date(endDate);
    }

    // Duration filter
    if (minDuration || maxDuration) {
      filter['timing.duration'] = {};
      if (minDuration) filter['timing.duration'].$gte = parseInt(minDuration);
      if (maxDuration) filter['timing.duration'].$lte = parseInt(maxDuration);
    }

    // Status filter
    if (status) {
      switch (status) {
        case 'success':
          filter['response.statusCode'] = { $gte: 200, $lt: 300 };
          break;
        case 'error':
          filter['response.statusCode'] = { $gte: 400 };
          break;
        case 'client-error':
          filter['response.statusCode'] = { $gte: 400, $lt: 500 };
          break;
        case 'server-error':
          filter['response.statusCode'] = { $gte: 500 };
          break;
      }
    }

    // Get requests with pagination
    const requests = await ApiRequest.find(filter)
      .populate('endpoint', 'name path method')
      .populate('product', 'name')
      .populate('userId', 'name email')
      .select('-response.body') // Exclude response body for performance
      .sort({ 'timing.startTime': -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await ApiRequest.countDocuments(filter);

    res.json({
      success: true,
      data: {
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
    console.error('Requests fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching requests'
    });
  }
});

// @route   GET /api/tracking/analytics
// @desc    Get detailed analytics data
// @access  Private
router.get('/analytics', [
  query('period').optional().isIn(['1h', '24h', '7d', '30d', 'all']).withMessage('Invalid period'),
  query('groupBy').optional().isIn(['hour', 'day', 'week', 'month']).withMessage('Invalid groupBy'),
  query('product').optional().isMongoId().withMessage('Invalid product ID'),
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

    const { period = '7d', groupBy = 'hour', product, environment } = req.query;

    // Calculate date range
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

    // Build filter
    const filter = {
      'timing.startTime': { $gte: startDate }
    };
    if (product) filter.product = product;
    if (environment) filter.environment = environment;

    // Build group by fields based on groupBy parameter
    let groupFields = {};
    switch (groupBy) {
      case 'hour':
        groupFields = {
          year: { $year: '$timing.startTime' },
          month: { $month: '$timing.startTime' },
          day: { $dayOfMonth: '$timing.startTime' },
          hour: { $hour: '$timing.startTime' }
        };
        break;
      case 'day':
        groupFields = {
          year: { $year: '$timing.startTime' },
          month: { $month: '$timing.startTime' },
          day: { $dayOfMonth: '$timing.startTime' }
        };
        break;
      case 'week':
        groupFields = {
          year: { $year: '$timing.startTime' },
          week: { $week: '$timing.startTime' }
        };
        break;
      case 'month':
        groupFields = {
          year: { $year: '$timing.startTime' },
          month: { $month: '$timing.startTime' }
        };
        break;
    }

    // Get analytics data
    const analytics = await ApiRequest.aggregate([
      { $match: filter },
      {
        $group: {
          _id: groupFields,
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
          avgResponseTime: { $avg: '$timing.duration' },
          minResponseTime: { $min: '$timing.duration' },
          maxResponseTime: { $max: '$timing.duration' },
          totalDataTransferred: { $sum: '$response.size' },
          uniqueUsers: { $addToSet: '$userId' },
          uniqueEndpoints: { $addToSet: '$endpoint' }
        }
      },
      {
        $addFields: {
          successRate: {
            $cond: [
              { $eq: ['$totalRequests', 0] },
              100,
              { $multiply: [{ $divide: ['$successfulRequests', '$totalRequests'] }, 100] }
            ]
          },
          uniqueUserCount: { $size: '$uniqueUsers' },
          uniqueEndpointCount: { $size: '$uniqueEndpoints' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1, '_id.week': 1 } }
    ]);

    // Format the results
    const formattedAnalytics = analytics.map(item => {
      let timestamp;
      switch (groupBy) {
        case 'hour':
          timestamp = new Date(item._id.year, item._id.month - 1, item._id.day, item._id.hour);
          break;
        case 'day':
          timestamp = new Date(item._id.year, item._id.month - 1, item._id.day);
          break;
        case 'week':
          timestamp = new Date(item._id.year, 0, 1 + (item._id.week - 1) * 7);
          break;
        case 'month':
          timestamp = new Date(item._id.year, item._id.month - 1, 1);
          break;
      }

      return {
        timestamp,
        totalRequests: item.totalRequests,
        successfulRequests: item.successfulRequests,
        failedRequests: item.failedRequests,
        successRate: Math.round(item.successRate),
        avgResponseTime: Math.round(item.avgResponseTime),
        minResponseTime: item.minResponseTime,
        maxResponseTime: item.maxResponseTime,
        totalDataTransferred: item.totalDataTransferred,
        uniqueUserCount: item.uniqueUserCount,
        uniqueEndpointCount: item.uniqueEndpointCount
      };
    });

    res.json({
      success: true,
      data: {
        period,
        groupBy,
        product: product || 'all',
        environment: environment || 'all',
        analytics: formattedAnalytics
      }
    });
  } catch (error) {
    console.error('Analytics fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching analytics'
    });
  }
});

// @route   GET /api/tracking/performance
// @desc    Get performance metrics and trends
// @access  Private
router.get('/performance', [
  query('period').optional().isIn(['1h', '24h', '7d', '30d', 'all']).withMessage('Invalid period'),
  query('product').optional().isMongoId().withMessage('Invalid product ID'),
  query('endpoint').optional().isMongoId().withMessage('Invalid endpoint ID')
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

    const { period = '24h', product, endpoint } = req.query;

    // Calculate date range
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

    // Build filter
    const filter = {
      'timing.startTime': { $gte: startDate }
    };
    if (product) filter.product = product;
    if (endpoint) filter.endpoint = endpoint;

    // Get performance metrics
    const performance = await ApiRequest.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$timing.duration' },
          p50ResponseTime: { $percentile: { input: '$timing.duration', p: 0.5 } },
          p90ResponseTime: { $percentile: { input: '$timing.duration', p: 0.9 } },
          p95ResponseTime: { $percentile: { input: '$timing.duration', p: 0.95 } },
          p99ResponseTime: { $percentile: { input: '$timing.duration', p: 0.99 } },
          minResponseTime: { $min: '$timing.duration' },
          maxResponseTime: { $max: '$timing.duration' },
          totalRequests: { $sum: 1 },
          slowRequests: {
            $sum: {
              $cond: [
                { $gt: ['$timing.duration', 1000] },
                1,
                0
              ]
            }
          },
          verySlowRequests: {
            $sum: {
              $cond: [
                { $gt: ['$timing.duration', 5000] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    // Get response time distribution
    const responseTimeDistribution = await ApiRequest.aggregate([
      { $match: filter },
      {
        $bucket: {
          groupBy: '$timing.duration',
          boundaries: [0, 100, 500, 1000, 2000, 5000, 10000, 30000],
          default: 'slow',
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]);

    // Get slowest endpoints
    const slowestEndpoints = await ApiRequest.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$endpoint',
          avgResponseTime: { $avg: '$timing.duration' },
          maxResponseTime: { $max: '$timing.duration' },
          requestCount: { $sum: 1 },
          slowRequestCount: {
            $sum: {
              $cond: [
                { $gt: ['$timing.duration', 1000] },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { avgResponseTime: -1 } },
      { $limit: 10 }
    ]);

    // Populate endpoint details
    const endpointIds = slowestEndpoints.map(item => item._id);
    const endpoints = await ApiEndpoint.find({ _id: { $in: endpointIds } }).select('name path method');
    const endpointMap = {};
    endpoints.forEach(endpoint => {
      endpointMap[endpoint._id.toString()] = endpoint;
    });

    const result = {
      period,
      product: product || 'all',
      endpoint: endpoint || 'all',
      metrics: performance[0] || {
        avgResponseTime: 0,
        p50ResponseTime: 0,
        p90ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        totalRequests: 0,
        slowRequests: 0,
        verySlowRequests: 0
      },
      responseTimeDistribution,
      slowestEndpoints: slowestEndpoints.map(item => ({
        ...item,
        endpoint: endpointMap[item._id.toString()] || { name: 'Unknown Endpoint' },
        slowRequestPercentage: Math.round((item.slowRequestCount / item.requestCount) * 100)
      }))
    };

    // Calculate percentages
    if (result.metrics.totalRequests > 0) {
      result.metrics.slowRequestPercentage = Math.round((result.metrics.slowRequests / result.metrics.totalRequests) * 100);
      result.metrics.verySlowRequestPercentage = Math.round((result.metrics.verySlowRequests / result.metrics.totalRequests) * 100);
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Performance fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching performance data'
    });
  }
});

module.exports = router; 