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


var currentDoc = {};
try {
	currentDoc = JSON.parse(fs.readFileSync('./current.json').toString());
} catch (e) {}

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

app.get('/doc/:id', function(req, res) {

		res.render('doc', {
			doc: marked(docMarkup(currentDoc.docs[req.params.id]))
		});
	})
	/**
	 * Renders the main page
	 * Does magic
	 */
app.get('/', function(req, res) {
	res.render('home', {
		sections: currentDoc.sections //marked(homeMarkup(json))
	});
});

app.post('/update', function(req, res) {
	try {
		var json = jsonpack.unpack(req.body.packed);
		currentDoc = json
		fs.writeFileSync('./current.json', JSON.stringify(json));

		res.send({
			success: true
		})
	} catch (e) {
		console.log(e);
		res.send({
			error: e
		})
	}
});


domain.connect(cfg, function() {
	var port = cfg.get('app.port', 8888);
	app.listen(port);
	console.log('listening on port:' + port);
});