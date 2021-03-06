// ember-cli-deploy-fastboot-api-lambda

var config 		= require('./config.json');
var mime 			= require('mime');
var fs 				= require('fs-promise');
var FastBoot 	= require('fastboot');

var fancyACacheYeh = {
	yes: 'max-age=63072000, public',
	no: 'max-age=0, public'
};

var defaults = {
	distPath: 'dist',
	path: '/',
	host: 'localhost',
	assetsPath: '/assets/',
	standardExtensions: [
		'html',
		'css',
		'js',
		'json',
		'xml',
		'ico',
		'txt',
		'map'
	],
	headers: {
		'Content-Type': 'text/html;charset=UTF-8',
		'Cache-Control': fancyACacheYeh.no
	},
	fastBootOptions: {
    request: {
      headers: {},
      get: function() {}
    },
    response: {}
  }
};

// Merge defaults with config overrides
var standardExtensions = defaults.standardExtensions.concat(config.standardExtensions || []);
var fallbackPath = config.defaultPath || defaults.path;

// Instantiate Fastboot server
var app = new FastBoot({ distPath: defaults.distPath });

exports.handler = function(event, context, callback) {
	console.log('INFO event:', event);

	var path = event.path || fallbackPath;
	var staticPath = defaults.distPath + '/' + path;

	console.log('INFO path:', path);
	console.log('INFO staticPath:', staticPath);

	return fs.readFile(staticPath)

	// STATIC FILE LOGIC
	.then(function(fileBuffer) {

		// 1. Look up files content type.
		var contentType = mime.lookup(staticPath);

		//2. Get file extension.
		var extension = mime.extension(contentType); 

		//3. If it isn't a standard file, then base64 encode it. 
		var shouldEncode = standardExtensions.indexOf(extension) < 0;

		//4. Determine if the item is fingerprinted/cacheable
		var shouldCache = staticPath.includes(defaults.assetsPath);

		//5. Set encoding value
		var encoding = shouldEncode ? 'base64' : 'utf8';

		//6. Create headers
		var headers = {
			'Content-Type': contentType,
			'Cache-Control': shouldCache ? fancyACacheYeh.yes : fancyACacheYeh.no
		};

		//7. Create body
		var body = fileBuffer.toString(encoding);

		//8. Create final output
		var payload = {
			statusCode: 200,
			headers: headers,
			body: body,
			isBase64Encoded: shouldEncode
		};

		console.log('INFO: contentType:', contentType);
		console.log('INFO: extension:', extension);
		console.log('INFO: standardExtensions:', standardExtensions);
		console.log('INFO: shouldEncode:', shouldEncode);
		console.log('INFO: shouldCache:', shouldCache);
		console.log('INFO: encoding:', encoding);

		return callback(null, payload);
	})

	// GO FASTBOOT GO!
	.catch(function() {

		// 1. Create options
		var options = defaults.fastBootOptions;
		options.request.headers = event.headers || {};
		options.request.headers.host = (event.headers || {}).Host || defaults.host;
		if (event.cookie) {
			options.request.headers.cookie = event.cookie;
		}

		console.log('INFO: options:', options);

		// 2. Fire up fastboot server
		return app.visit(path, options)
    .then(function(result) {
    	return result.html()
    	.then(function(html) {

    		console.log('INFO: html:', html);

    		// 3. Create headers object
    		var headers = Object.assign(result.headers.headers, defaults.headers);

    		console.log('INFO: headers:', headers);

    		// 4. Create payload
	    	var payload = {
	        statusCode: result.statusCode,
	        headers: headers,
	        body: html
	    	};

	    	// 5. Profit ???
	      return callback(null, payload);
    	});
    })
    .catch(err => callback(err));

	});

};
