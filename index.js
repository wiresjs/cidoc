#!/usr/bin/env node

/**
 * @category Essentials
 * @module  CLI
 *
 *
 * @summary
 * This is a greates module in the world, because it's awesome
 * multiline here
 * some super massive description
 *
 * @name  Main Interface
 */

var fs = require('fs');
var Class = require('wires-class');
var logger = require('log4js').getLogger('jddoc');
var lineReader = require('line-reader');
var _ = require('lodash');
var path = require('path')

var async = require('async')
var shortid = require('shortid');
var jsonpack = require('jsonpack');


var slugify = function(text) {
	return text.toLowerCase()
		.replace(/[^\w ]+/g, '')
		.replace(/ +/g, '-');
};

/**
 * @function getConfiguration
 * Gets configuration
 */
var getConfiguration = function() {
	var configFile = './.cidoc';
	var config = {}
	if (fs.existsSync(configFile)) {
		try {
			var config = JSON.parse(fs.readFileSync(configFile));
		} catch (e) {
			logger.warn("Problems with configuration file ", e);
		}
	} else {
		logger.warn("Configuration file was not found");
		process.exit(1);
	}
	return config;
}

var extractData = function(line) {
	if (!line)
		return;

	if (line.code) {
		return {
			macro: "code",
			code: line.code
		}
	}
	var matches = line.match(/@([^\s]+)\s?(.*?)$/i)

	if (matches) {
		return {
			macro: matches[1].trim(),
			text: matches[2].trim()
		}
	} else {
		return {
			macro: 'text',
			text: line.trim()
		}
	}
}

/**
 * @function extractParams
 * Extracts parameters from a string
 * Lorem Ipsum is simply dummy text of the printing and typesetting industry.
 * Lorem Ipsum has been the industry's standard dummy text ever since the 1500s,
 * when an unknown printer took a galley of type and scrambled it to make
 * a type specimen book. It has survived not only five centuries,
 * but also the leap into electronic typesetting, remaining essentially unchanged.
 * It was popularised in the 1960s with the release of Letraset sheets containing
 * Lorem Ipsum passages, and more recently with desktop publishing software
 * like Aldus PageMaker including versions of Lorem Ipsum.
 * ```js
 * var a = 1;
 * ```
 *
 * @param  {[type]} line [description]
 * @return {[type]}      [description]
 */
var extractParams = function(line) {
	var data = line.match(/\{([^\s]+)\}(\s*([^\s]+)\s*(.*))?/i);
	if (data && data.length === 5) {
		return {
			type: data[1],
			name: data[3],
			desc: data[4]
		}
	}
	return null;
}

/**
 * @function
 * Gets file contents
 * If it fails to fetch it returns null
 * @return {[type]} [description]
 */
var getFileContents = function(fname) {
	try {
		return fs.readFileSync(fname).toString();
	} catch (e) {
		logger.fatal("Failed to read " + fname);
		return null;
	}
}

var JSDoc = Class.extend({
	initialize: function() {
		this.blocks = [];
		this.pushing = [];
		this.waitingForCodeHeader = false;
		_.bindAll(this);
	},


	/**
	 * Parses the file
	 * @param  {string} fname file name
	 * @return {void}
	 */
	parse: function(fname, cb) {

		this.fname = fname;
		this.cb = cb;

		var contents = getFileContents(fname);

		if (!contents) {
			cb(null);
			return;
		}
		this.cb = cb;

		var self = this;

		lineReader.eachLine(fname, function(line, last) {

			if (last) {
				self.onLine(line);

				self.doneInitialParsing();
			} else {
				self.onLine(line);
			}
		});
	},
	doneInitialParsing: function() {
		var doc = {
			info: {
				category: null,
				module: null,
				name: null,
				summary: [],
				filepath: this.fname
			},
			methods: [],
			functions: []
		};

		var collectSummary = false;

		_.each(this.blocks, function(block) {
			var method = {
				code: null,
				title: null,
				description: [],
				params: [],
				returns: {}
			};
			var useFunction = false;
			var headersSet = false;
			var description = [];
			_.each(block, function(i) {

				var data = extractData(i);
				if (data) {
					if (data.macro === "summary") {
						collectSummary = true;
						doc.info.summary = [data.text];
					}

					if (data.macro === "function") {
						useFunction = true;
						if (data.text) {
							method.title = data.text;
						}
					}
					if (data.macro === "module") {
						doc.info.module = data.text;
					}
					if (data.macro === "category") {
						doc.info.category = data.text;
						headersSet = true;
					}
					if (data.macro === "name") {
						doc.info.name = data.text;
					}
					if (data.macro === "param") {
						var params = extractParams(data.text);
						if (params) {
							method.params.push(params);
						}
					}
					if (data.macro === "return") {
						method.returns = extractParams(data.text);

					}
					if (data.macro === "code") {
						method.code = data.code;
						if (method.code[0] === "\t") {
							method.code = method.code.substring(1, data.code.length);
						}
					}
					if (data.macro === "text") {
						if (data.text) {
							if (collectSummary) {
								doc.info.summary.push(data.text);
							}
							if (method.title === null) {
								method.title = data.text
							} else {
								method.description.push(data.text);
							}
						}
					}
				}

			});
			collectSummary = false;
			//doc.info.summary = doc.info.summary.join('\n');

			if (headersSet === false) {
				if (useFunction) {
					doc.functions.push(method);
				} else {
					doc.methods.push(method);
				}
			}
		});
		if (this.cb) {
			this.cb(doc);
		}
	},

	/**
	 * Triggers on each line
	 * @param  {[type]} 	line [description]
	 * @return {[type]}      [description]
	 */
	onLine: function(line) {
		if (this.waitingForCodeHeader) {

			if (line && this.blocks.length) {
				this.blocks[this.blocks.length - 1].push({
					code: line
				});
				this.waitingForCodeHeader = false;
			}

		} else {

			if (line.match(/\*\//) && this.pushing) {
				this.pushing = false;
				this.waitingForCodeHeader = true;
			}
			if (line.match(/\/\*\*/)) {
				this.pushing = true;
				this.blocks.push([])
			}
			if (this.blocks.length > 0 && this.pushing) {

				var text = line.split('/').join('').split('*').join('').split('\t').join('');
				this.blocks[this.blocks.length - 1].push(text);
			}
		}
	}
})

var ignoredFolders = ['node_modules', 'bower_components', '.git'];
var validFormat = /.js$/


/**
 * Gets documenation
 * @param  {[type]} dir  [description]
 * @param  {[type]} name [description]
 * @return {[type]}      [description]
 */
var getDocsFromDirectory = function(dir, sectionName, done) {

	var files = [];

	var section = {};
	var docs = {};


	var runDirs = function(dir, done) {
		var results = [];
		fs.readdir(dir, function(err, list) {
			if (err) return done(err);
			var i = 0;
			(function next() {
				var file = list[i++];
				if (!file) return done(null, results);
				file = dir + '/' + file;
				fs.stat(file, function(err, stat) {

					if (stat && stat.isDirectory()) {

						var validRootFolder = _.filter(ignoredFolders, function(f) {
							return file.indexOf(f) > -1
						}).length === 0;
						if (validRootFolder) {
							runDirs(file, function(err, res) {
								results = results.concat(res);
								next();
							});
						} else {
							next();
						}
					} else {
						if (validFormat.test(file)) {
							results.push(file);
						}
						next();
					}
				});
			})();
		});
	};

	runDirs(dir, function(err, files) {

		async.eachSeries(files, function(file, next) {

			var jdoc = new JSDoc();
			jdoc.parse(file, function(doc) {

				if (!doc) {
					next();
					return
				}
				if (!doc.info.category || !doc.info.module || !doc.info.name) {
					next();
					return
				}

				var info = doc.info;
				if (!section[info.category]) {
					section[info.category] = {
						name: info.category,
						modules: {}
					}
				}
				if (!section[info.category].modules[info.module]) {
					section[info.category].modules[info.module] = {
						docs: []
					}
				}
				var docId = slugify(sectionName + " " + doc.info.category + " " + doc.info.module + " " + doc.info.name);
				docs[docId] = doc;
				section[info.category].modules[info.module].docs.push({
					name: info.name,
					filepath: info.filepath,
					id: docId
				});
				next(null);
			});

		}, function() {
			done({
				contents: section,
				docs: docs
			});
		});
	})

}

var configuration = getConfiguration();

var SendData = function(data) {
	var packed = jsonpack.pack(data);
	var request = require('request');
	request.post({
		url: configuration.host,
		form: {
			packed: packed
		}
	}, function(error, response, body) {
		console.log(body);
	});


	//
	//	var json = jsonpack.unpack(packed);
	//	console.log(JSON.stringify(json, 2, 2))
}
var CIDoc;

exports.module = CIDoc = {
	/**
	 * Generates json based on given instructions
	 * @param  {object}   folders list of files
	 * @param  {Function} cb      [description]
	 * @return {[type]}           [description]
	 */
	generate: function(folders, cb) {
		var data = {};

		var docs = {};
		var sections = {};
		async.eachSeries(folders, function(item, next) {
			getDocsFromDirectory(item.dir, item.section, function(section) {

				sections[item.section] = section.contents;
				docs = _.merge(docs, section.docs);
				next();
			});
		}, function() {
			cb({
				sections: sections,
				docs: docs
			});
		});
	},

	/**
	 * Sends data to a remote server
	 * @param  {[type]}   folders [description]
	 * @param  {Function} cb      [description]
	 */
	send: function(conf) {
		this.generate(conf.folders, function(data) {
			SendData(data);
		});
	}
}


CIDoc.send(configuration)