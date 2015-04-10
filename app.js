/**
 * @category Main
 * @module  MainApplication
 *
 *
 * @summary Entry point
 *
 * @name  App
 */


var domain = require('wires-domain');
var express = require('express');
var path = require('path')
var Config = require('wires-config');
var swig = require('swig');
var fs = require('fs');
var jsonpack = require('jsonpack');
var basicAuth = require('connect-basic-auth');
var mkdirp = require('mkdirp');
var path = require('path');

var logFile = './docs/log.json';

var getVersionLogFile = function() {
	if (!fs.existsSync(logFile)) {
		fs.writeFileSync(logFile, "[]");
	}
	var docs = JSON.parse(fs.readFileSync(logFile));
	docs.reverse();
	return docs;
}

/**
 * Writes version to log
 *
 * Usage example:
 * '''js
 * writeVersionLog('1.0.1', "Some super message", "ivan")
 * something({
 *      name : "1122"
 * })
 * '''
 */
var writeVersionLog = function(version, message, username) {

	var logs = getVersionLogFile();

	var now = new Date()

	logs.push({
		version: version,
		message: message,
		username: username || "Unknown",
		date: now
	});


	if (logs.length > 100) {
		logs.shift();
	}
	fs.writeFileSync(logFile, JSON.stringify(logs));
}

var jsonVersionCache = {};

var readDocVersion = function(version, refresh) {

	var keys = Object.keys(jsonVersionCache);
	if (keys.length > 20) {
		delete jsonVersionCache[keys[0]];
	}
	if (!jsonVersionCache[version] && !refresh) {
		jsonVersionCache[version] = JSON.parse(fs.readFileSync('./docs/' + version));
	}
	return jsonVersionCache[version];
}


var cfg = new Config({
	domain: domain
});
cfg.load('app.conf');


var docMarkup = require('./doc-markup');


var app = domain.webApp();


app.use(basicAuth(function(credentials, req, res, next) {
	if (credentials.username === 'admin' && credentials.password === '111111') {
		next(null);
	} else {
		next('Credentials please');
	}
}, 'Please enter your credentials.'));

app.all('*', function(req, res, next) {
	req.requireAuthorization(req, res, next);
});

app.engine('html', swig.renderFile);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.use('/public', express.static(path.join(__dirname, 'public')));

var marked = require('marked');



marked.setOptions({
	highlight: function(code) {
		return require('highlight.js').highlightAuto(code).value;
	},
	renderer: new marked.Renderer(),
	gfm: true,
	tables: true,
	breaks: false,
	pedantic: false,
	sanitize: true,
	smartLists: true,
	smartypants: false
});

app.get('/doc/:version/:id', function(req, res) {
	var currentDoc = readDocVersion(req.params.version, req.query.reload);

	res.render('doc', {
		doc: marked(docMarkup(currentDoc.docs[req.params.id])),
		version: req.params.version
	});
})

app.get('/', function(req, res) {
	res.render('versions', {
		versions: getVersionLogFile()
	});
});

app.get('/version/:version', function(req, res) {
	if (!req.params.version) {
		return res.send("Not found");
	}
	var version = req.params.version;

	var doc = readDocVersion(version, req.query.reload);
	res.render('home', {
		sections: doc.sections,
		version: req.params.version
	});
});

app.post('/update', function(req, res) {
	try {
		var json = jsonpack.unpack(req.body.packed);

		var version = req.body.version || new Date().getTime() + "";
		var message = req.body.message || "Version " + version;
		var username = req.body.username;
		var log = req.body.log !== 'false';
		console.log(req.body.log);
		if (log) {
			console.log("WWIRTE LOG")
			writeVersionLog(version, message, username, log);
		}
		// Writing documenation json to a folder
		var versionFile = path.join('./docs/', version);
		fs.writeFileSync(versionFile, JSON.stringify(json));

		res.send({
			success: true
		})
	} catch (e) {
		console.log(e.stack);
		res.send({
			error: e
		})
	}
});



domain.connect(cfg, function() {
	mkdirp.sync('./docs/');
	var port = cfg.get('app.port', 8888);
	app.listen(port);
	console.log('listening on port:' + port);
});