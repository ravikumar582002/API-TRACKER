# API Tracker - Product API Monitoring System

A comprehensive API tracking and monitoring system designed for product development teams. Track API endpoints, monitor performance, analyze usage patterns, and maintain detailed logs of all API interactions.

## 🚀 Features

### Core Functionality
- **Product Management** - Organize APIs by products and features
- **API Endpoint Tracking** - Monitor individual API endpoints with detailed metrics
- **Request/Response Logging** - Complete audit trail of all API interactions
- **Performance Analytics** - Real-time performance monitoring and trend analysis
- **Dashboard & Reporting** - Beautiful visualizations and comprehensive reports

### Advanced Features
- **Real-time Monitoring** - Live tracking of API health and performance
- **Error Tracking** - Automatic detection and logging of API errors
- **Response Time Analysis** - Detailed performance metrics and bottlenecks
- **Status Code Distribution** - Monitor success rates and error patterns
- **Environment Support** - Track APIs across development, staging, and production
- **API Testing** - Built-in API testing functionality with request/response validation

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database with Mongoose ODM
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **express-validator** - Input validation
- **helmet** - Security middleware

### Frontend
- **React 18** - UI framework
- **React Router** - Client-side routing
- **React Query** - Data fetching and caching
- **Tailwind CSS** - Styling framework
- **Recharts** - Data visualization
- **React Hook Form** - Form management
- **Axios** - HTTP client

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd API-TRACKER
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGO_URI=mongodb://localhost:27017/api-tracker
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   CORS_ORIGIN=http://localhost:3000
   ```

4. **Start the server**
   ```bash
   npm run dev
   ```

### Frontend Setup

1. **Navigate to client directory**
   ```bash
   cd client
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 🗄️ Database Schema

### Products
- Basic product information (name, description, version)
- Status tracking (active, inactive, deprecated, beta)
- Category classification (web, mobile, desktop, api, service)
- Team management and ownership
- Environment configurations
- Performance metrics aggregation

### API Endpoints
- Endpoint details (name, path, method, base URL)
- Request/response schemas
- Authentication requirements
- Rate limiting configuration
- Performance metrics
- Documentation and tags

### API Requests
- Complete request/response logging
- Performance timing data
- Error tracking and categorization
- User and session information
- Environment and source tracking

### Users
- Authentication and authorization
- Role-based permissions
- API key management
- User preferences and settings

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/generate-api-key` - Generate API key

### Products
- `GET /api/products` - List all products
- `POST /api/products` - Create new product
- `GET /api/products/:id` - Get product details
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `GET /api/products/:id/apis` - Get product APIs
- `GET /api/products/:id/metrics` - Get product metrics

### API Endpoints
- `GET /api/endpoints` - List all API endpoints
- `POST /api/endpoints` - Create new endpoint
- `GET /api/endpoints/:id` - Get endpoint details
- `PUT /api/endpoints/:id` - Update endpoint
- `DELETE /api/endpoints/:id` - Delete endpoint
- `POST /api/endpoints/:id/test` - Test endpoint
- `GET /api/endpoints/:id/requests` - Get endpoint requests

### Tracking & Analytics
- `GET /api/tracking/dashboard` - Dashboard overview
- `GET /api/tracking/requests` - Request history
- `GET /api/tracking/analytics` - Detailed analytics
- `GET /api/tracking/performance` - Performance metrics

## 🎯 Usage Guide

### 1. Getting Started
1. Register a new account or login
2. Create your first product
3. Add API endpoints to the product
4. Start monitoring API performance

### 2. Product Management
- Create products to organize your APIs
- Assign team members and set permissions
- Configure environment URLs (dev, staging, prod)
- Track product-level metrics and performance

### 3. API Endpoint Configuration
- Define API endpoints with full specifications
- Set up authentication requirements
- Configure rate limiting rules
- Add request/response schemas
- Include documentation and examples

### 4. Monitoring & Testing
- Use the built-in API tester to validate endpoints
- Monitor real-time performance metrics
- Track error rates and response times
- Analyze usage patterns and trends

### 5. Analytics & Reporting
- View comprehensive dashboards
- Generate performance reports
- Analyze status code distributions
- Monitor user activity and API usage

## 🔧 Configuration

### Environment Variables
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
MONGO_URI=mongodb://localhost:27017/api-tracker

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Security Configuration
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### MongoDB Indexes
The application automatically creates optimized indexes for:
- Product search and filtering
- API endpoint queries
- Request history and analytics
- User authentication

## 🚀 Deployment

### Production Setup
1. Set `NODE_ENV=production`
2. Configure production MongoDB connection
3. Set secure JWT secret
4. Configure CORS for production domain
5. Set up SSL/TLS certificates
6. Configure reverse proxy (nginx)

### Docker Deployment
```bash
# Build the application
docker build -t api-tracker .

# Run with MongoDB
docker-compose up -d
```

## 📈 Performance

### Optimizations
- Database indexing for fast queries
- Request/response caching
- Pagination for large datasets
- TTL indexes for automatic data cleanup
- Compression middleware
- Rate limiting protection

### Monitoring
- Real-time performance metrics
- Error tracking and alerting
- Database query optimization
- Memory and CPU usage monitoring

## 🔒 Security

### Features
- JWT-based authentication
- Password hashing with bcrypt
- Input validation and sanitization
- CORS protection
- Rate limiting
- Helmet security headers
- SQL injection prevention

### Best Practices
- Use strong JWT secrets
- Implement proper CORS policies
- Regular security updates
- Monitor for suspicious activity
- Backup data regularly

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API reference

## 🔄 Roadmap

### Planned Features
- [ ] Webhook notifications
- [ ] Advanced alerting system
- [ ] API documentation generator
- [ ] Load testing integration
- [ ] Multi-tenant support
- [ ] Mobile application
- [ ] Advanced analytics
- [ ] API versioning support

---

**API Tracker** - Empowering teams to build better APIs through comprehensive monitoring and analytics. 