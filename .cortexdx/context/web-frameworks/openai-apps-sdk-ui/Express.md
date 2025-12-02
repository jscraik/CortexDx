# Express.js Web Framework

Express is a minimal and flexible Node.js web application framework that provides a robust set of features for web and mobile applications. Currently at version 5.x, Express requires Node.js 18 or higher and supports both CommonJS and ES modules. It simplifies the process of building server-side applications by providing a thin layer of fundamental web application features without obscuring Node.js features. Express is the de facto standard server framework for Node.js and serves as the foundation for countless web applications and APIs.

The framework is designed around middleware functions that have access to the request object, response object, and the next middleware function in the application's request-response cycle. Express provides methods to specify what function should be called for a particular HTTP verb and URL pattern, and methods to specify what template engine to use, where template files are located, and what template to use to render a response. It enables developers to create robust APIs quickly with minimal code while maintaining complete control over the application's behavior. Version 5 brings enhanced modern JavaScript support, improved error handling, and better TypeScript compatibility.

## Application Initialization

Creating and configuring an Express application instance

```javascript
// ES Module syntax (recommended for new projects)
import express from 'express';
const app = express();

// CommonJS syntax (still fully supported)
// const express = require('express');
// const app = express();

// Configure application settings
app.set('port', process.env.PORT || 3000);
app.set('view engine', 'ejs');
app.set('views', './views');
app.set('json spaces', 2);

// Enable or disable features
app.enable('trust proxy');
app.disable('x-powered-by');

// Start the server
const server = app.listen(app.get('port'), () => {
  console.log(`Server running on port ${app.get('port')}`);
});

// Output: Server running on port 3000
```

## Basic Route Handling

Defining routes for different HTTP methods and URL patterns

```javascript
const express = require('express');
const app = express();

// GET request handler
app.get('/', (req, res) => {
  res.send('Hello World');
});

// POST request handler
app.post('/users', (req, res) => {
  res.status(201).json({ id: 1, name: 'John Doe' });
});

// PUT request handler
app.put('/users/:id', (req, res) => {
  const userId = req.params.id;
  res.json({ id: userId, name: 'Updated User' });
});

// DELETE request handler
app.delete('/users/:id', (req, res) => {
  res.status(204).send();
});

// Handle all HTTP methods for a route
app.all('/secret', (req, res) => {
  res.send(`Method: ${req.method}`);
});

app.listen(3000);
```

## Middleware Functions

Using middleware for request processing and application logic

```javascript
const express = require('express');
const app = express();

// Built-in middleware for parsing JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

// Authentication middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization;
  if (token === 'Bearer valid-token') {
    req.user = { id: 1, name: 'John' };
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Route-specific middleware
app.get('/protected', authenticate, (req, res) => {
  res.json({ message: 'Secret data', user: req.user });
});

// Error-handling middleware (must have 4 parameters)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message });
});

app.listen(3000);
```

## Route Parameters

Capturing dynamic URL segments and query strings

```javascript
const express = require('express');
const app = express();

// URL parameters
app.get('/users/:userId/posts/:postId', (req, res) => {
  const { userId, postId } = req.params;
  res.json({
    user: userId,
    post: postId,
    url: req.url
  });
});

// Query string parameters
app.get('/search', (req, res) => {
  const { q, limit = 10, page = 1 } = req.query;
  res.json({
    query: q,
    limit: parseInt(limit),
    page: parseInt(page),
    results: []
  });
});

// Parameter middleware
app.param('userId', (req, res, next, id) => {
  // Simulate database lookup
  if (id === '123') {
    req.userData = { id, name: 'John Doe' };
    next();
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

app.get('/users/:userId', (req, res) => {
  res.json(req.userData);
});

app.listen(3000);
// GET /users/123/posts/456 → {"user":"123","post":"456","url":"/users/123/posts/456"}
// GET /search?q=express&limit=20 → {"query":"express","limit":20,"page":1,"results":[]}
```

## Response Methods

Sending different types of responses to clients

```javascript
const express = require('express');
const app = express();

// Send plain text
app.get('/text', (req, res) => {
  res.send('Plain text response');
});

// Send JSON
app.get('/json', (req, res) => {
  res.json({ success: true, data: { id: 1, name: 'Item' } });
});

// Send with status code
app.get('/created', (req, res) => {
  res.status(201).json({ message: 'Resource created' });
});

// Send status only
app.get('/nocontent', (req, res) => {
  res.sendStatus(204);
});

// Set headers and send
app.get('/custom', (req, res) => {
  res.set('X-Custom-Header', 'value')
     .set('Cache-Control', 'no-cache')
     .json({ data: 'with custom headers' });
});

// Redirect
app.get('/old-route', (req, res) => {
  res.redirect(301, '/new-route');
});

// Send file
app.get('/download', (req, res) => {
  res.sendFile('/path/to/file.pdf', { root: __dirname });
});

app.listen(3000);
```

## Router Module

Creating modular route handlers with Express Router

```javascript
const express = require('express');
const app = express();

// Create router instance
const userRouter = express.Router();

// Router-level middleware
userRouter.use((req, res, next) => {
  console.log('User router middleware');
  next();
});

// Define routes on the router
userRouter.get('/', (req, res) => {
  res.json([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ]);
});

userRouter.get('/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'User' });
});

userRouter.post('/', (req, res) => {
  res.status(201).json({ id: 3, name: req.body.name });
});

// Mount router on application
app.use('/api/users', userRouter);

// Create another router for posts
const postRouter = express.Router({ mergeParams: true });

postRouter.get('/', (req, res) => {
  res.json([
    { id: 1, userId: req.params.userId, title: 'Post 1' }
  ]);
});

app.use('/api/users/:userId/posts', postRouter);

app.listen(3000);
// GET /api/users → returns user list
// GET /api/users/123 → returns user 123
// GET /api/users/123/posts → returns posts for user 123
```

## Request Object Properties

Accessing request data and metadata

```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.post('/analyze', (req, res) => {
  const requestInfo = {
    // HTTP method
    method: req.method,

    // Request URL parts
    url: req.url,
    originalUrl: req.originalUrl,
    path: req.path,
    baseUrl: req.baseUrl,

    // Headers
    contentType: req.get('Content-Type'),
    userAgent: req.get('User-Agent'),

    // Request body (requires middleware)
    body: req.body,

    // Query parameters
    query: req.query,

    // URL parameters
    params: req.params,

    // IP address
    ip: req.ip,

    // Protocol
    protocol: req.protocol,
    secure: req.secure,

    // Hostname
    hostname: req.hostname,

    // Content negotiation
    accepts: req.accepts(['json', 'html']),

    // Check content type
    isJson: req.is('json'),

    // AJAX request check
    xhr: req.xhr
  };

  res.json(requestInfo);
});

app.listen(3000);
// POST /analyze?search=express with JSON body
// Returns comprehensive request information object
```

## Static File Serving

Serving static files like HTML, CSS, JavaScript, and images

```javascript
const express = require('express');
const path = require('path');
const app = express();

// Serve static files from 'public' directory
app.use(express.static('public'));

// Serve with virtual path prefix
app.use('/static', express.static('public'));

// Serve with options
app.use('/assets', express.static('public', {
  dotfiles: 'deny',
  index: false,
  maxAge: '1d',
  setHeaders: (res, path, stat) => {
    res.set('X-Custom-Header', 'StaticFile');
  }
}));

// Multiple static directories
app.use(express.static('public'));
app.use(express.static('uploads'));

// Serve files with route
app.get('/report.pdf', (req, res) => {
  const filePath = path.join(__dirname, 'reports', 'report.pdf');
  res.sendFile(filePath);
});

// Download file (forces download dialog)
app.get('/download', (req, res) => {
  const file = path.join(__dirname, 'files', 'document.pdf');
  res.download(file, 'custom-name.pdf', (err) => {
    if (err) {
      console.error('Download error:', err);
    }
  });
});

app.listen(3000);
// Files in public/ accessible at: http://localhost:3000/filename.ext
// Files with /static prefix: http://localhost:3000/static/filename.ext
```

## Cookie Management

Setting and reading cookies in Express applications

```javascript
const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();

// Enable cookie parsing
app.use(cookieParser('secret-key'));

// Set cookies
app.get('/set-cookie', (req, res) => {
  // Basic cookie
  res.cookie('username', 'john_doe');

  // Cookie with options
  res.cookie('session', 'abc123', {
    maxAge: 900000,  // 15 minutes
    httpOnly: true,
    secure: false,
    signed: true
  });

  // Multiple cookies
  res.cookie('theme', 'dark')
     .cookie('language', 'en')
     .json({ message: 'Cookies set' });
});

// Read cookies
app.get('/get-cookies', (req, res) => {
  res.json({
    cookies: req.cookies,
    signedCookies: req.signedCookies
  });
});

// Clear cookies
app.get('/clear-cookie', (req, res) => {
  res.clearCookie('username');
  res.json({ message: 'Cookie cleared' });
});

app.listen(3000);
// GET /set-cookie → sets cookies with various options
// GET /get-cookies → returns all cookies
// GET /clear-cookie → removes specific cookie
```

## Template Rendering

Rendering dynamic views with template engines

```javascript
const express = require('express');
const app = express();

// Configure template engine
app.set('view engine', 'ejs');
app.set('views', './views');

// Enable view caching in production
if (app.get('env') === 'production') {
  app.enable('view cache');
}

// Render template with data
app.get('/user/:id', (req, res) => {
  const user = {
    id: req.params.id,
    name: 'John Doe',
    email: 'john@example.com',
    posts: [
      { title: 'First Post', date: '2024-01-01' },
      { title: 'Second Post', date: '2024-01-15' }
    ]
  };

  res.render('user', { user, title: 'User Profile' });
});

// Application-wide locals
app.locals.siteName = 'My Website';
app.locals.currentYear = new Date().getFullYear();

// Response-specific locals
app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  next();
});

app.get('/dashboard', (req, res) => {
  res.render('dashboard', {
    data: { stats: { users: 100, posts: 500 } }
  });
});

// Render without sending
app.get('/email-preview', (req, res) => {
  app.render('email', { name: 'John' }, (err, html) => {
    if (err) {
      res.status(500).send('Render error');
    } else {
      res.send(html);
    }
  });
});

app.listen(3000);
```

## Error Handling

Comprehensive error handling strategies

```javascript
const express = require('express');
const app = express();

app.use(express.json());

// Async error handling wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Routes with potential errors
app.get('/sync-error', (req, res, next) => {
  throw new Error('Synchronous error occurred');
});

app.get('/async-error', asyncHandler(async (req, res) => {
  const data = await Promise.reject(new Error('Async error'));
  res.json(data);
}));

// Custom error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

app.get('/not-found', (req, res, next) => {
  next(new AppError('Resource not found', 404));
});

// 404 handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`
  });
});

// Global error handler (must be last)
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);

  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.listen(3000);
```

## Content Negotiation

Responding with different content types based on client preferences

```javascript
const express = require('express');
const app = express();

app.get('/data', (req, res) => {
  const data = {
    id: 1,
    name: 'Product',
    price: 99.99
  };

  // Respond based on Accept header
  res.format({
    'text/plain': () => {
      res.send(`Product: ${data.name}, Price: $${data.price}`);
    },

    'text/html': () => {
      res.send(`<h1>${data.name}</h1><p>Price: $${data.price}</p>`);
    },

    'application/json': () => {
      res.json(data);
    },

    'application/xml': () => {
      res.type('application/xml');
      res.send(`<product><name>${data.name}</name><price>${data.price}</price></product>`);
    },

    'default': () => {
      res.status(406).send('Not Acceptable');
    }
  });
});

// Check accepted types
app.get('/check', (req, res) => {
  if (req.accepts('json')) {
    res.json({ format: 'json' });
  } else if (req.accepts('html')) {
    res.send('<p>HTML format</p>');
  } else {
    res.status(406).send('Not Acceptable');
  }
});

app.listen(3000);
// curl -H "Accept: application/json" http://localhost:3000/data → JSON response
// curl -H "Accept: text/html" http://localhost:3000/data → HTML response
```

## Request Body Parsing

Parsing different request body formats

```javascript
const express = require('express');
const app = express();

// JSON body parser
app.use(express.json({ limit: '10mb' }));

// URL-encoded body parser
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Raw body parser
app.use('/webhook', express.raw({ type: 'application/json' }));

// Text body parser
app.use('/logs', express.text({ type: 'text/plain' }));

// Handle JSON POST
app.post('/api/users', (req, res) => {
  const { name, email, age } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      error: 'Missing required fields'
    });
  }

  res.status(201).json({
    id: Date.now(),
    name,
    email,
    age: age || null
  });
});

// Handle form submission
app.post('/submit', (req, res) => {
  const formData = req.body;
  res.json({
    message: 'Form received',
    data: formData
  });
});

// Handle raw webhook
app.post('/webhook', (req, res) => {
  const signature = req.get('X-Signature');
  const payload = req.body;
  res.json({ received: true, bytes: payload.length });
});

app.listen(3000);
// POST /api/users with {"name":"John","email":"john@example.com"}
// → {"id":1234567890,"name":"John","email":"john@example.com","age":null}
```

## Route Chaining

Creating chainable route handlers for cleaner code

```javascript
const express = require('express');
const app = express();

app.use(express.json());

// Chain multiple methods on same route
app.route('/users/:id')
  .get((req, res) => {
    res.json({ id: req.params.id, name: 'User' });
  })
  .put((req, res) => {
    res.json({ id: req.params.id, ...req.body, updated: true });
  })
  .delete((req, res) => {
    res.status(204).send();
  });

// Chain middleware and handlers
app.route('/posts/:id')
  .all((req, res, next) => {
    console.log(`Accessing post ${req.params.id}`);
    next();
  })
  .get((req, res) => {
    res.json({ id: req.params.id, title: 'Post Title' });
  })
  .patch((req, res) => {
    res.json({ id: req.params.id, ...req.body });
  });

// Multiple handlers on single route
const validate = (req, res, next) => {
  if (!req.body.title) {
    return res.status(400).json({ error: 'Title required' });
  }
  next();
};

const sanitize = (req, res, next) => {
  req.body.title = req.body.title.trim();
  next();
};

app.post('/articles',
  validate,
  sanitize,
  (req, res) => {
    res.status(201).json({
      id: Date.now(),
      title: req.body.title
    });
  }
);

app.listen(3000);
```

## Application Mounting

Mounting sub-applications for modular architecture

```javascript
const express = require('express');
const app = express();

// Create sub-application for admin
const admin = express();

admin.get('/', (req, res) => {
  res.json({ section: 'admin dashboard' });
});

admin.get('/users', (req, res) => {
  res.json({ users: ['admin1', 'admin2'] });
});

admin.on('mount', (parent) => {
  console.log('Admin mounted');
  console.log('Mounted at:', admin.mountpath);
});

// Mount admin app
app.use('/admin', admin);

// Create API v1 sub-application
const apiV1 = express();

apiV1.get('/users', (req, res) => {
  res.json({ version: 1, users: [] });
});

app.use('/api/v1', apiV1);

// Create API v2 sub-application
const apiV2 = express();

apiV2.get('/users', (req, res) => {
  res.json({ version: 2, users: [], pagination: {} });
});

app.use('/api/v2', apiV2);

// Main app routes
app.get('/', (req, res) => {
  res.json({
    endpoints: [
      '/admin',
      '/api/v1/users',
      '/api/v2/users'
    ]
  });
});

app.listen(3000);
// GET /admin → admin dashboard
// GET /api/v1/users → v1 API response
// GET /api/v2/users → v2 API response
```

# Summary

Express.js version 5.x excels at building RESTful APIs, web applications, and microservices with its minimalist approach and powerful middleware system. Common use cases include single-page application backends, real-time applications with WebSocket integration, API gateways, authentication services, and content management systems. The framework's routing system enables clean URL structures, while its middleware architecture allows for modular request processing including authentication, logging, validation, and error handling. Express integrates seamlessly with template engines for server-side rendering, database libraries for data persistence, and can be extended with thousands of middleware packages from npm. With support for both CommonJS and ES modules, Express 5.x provides flexibility for modern JavaScript development.

Integration patterns typically involve organizing applications into routers for different resources, implementing authentication middleware chains, creating custom error handlers for consistent error responses, and using application locals for shared data. Express works well with MongoDB through Mongoose, PostgreSQL through Sequelize, Prisma, or Knex, and Redis for session management and caching. It's commonly deployed with PM2 for process management, behind Nginx as a reverse proxy, or in containerized environments using Docker and Kubernetes. The framework's simplicity makes it ideal for microservice architectures where each service handles specific business logic, serverless deployments on platforms like AWS Lambda or Vercel, and edge computing scenarios. Express 5.x's improved error handling and modern JavaScript support make it suitable for high-traffic production applications when properly configured with clustering, caching strategies, and monitoring tools.