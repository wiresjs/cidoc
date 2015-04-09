var _ = require('lodash')
module.exports = function(json) {
	console.log(json)
	var markup = [];

	markup.push('# ' + json.info.module + " / " + json.info.category + " / " + json.info.name);
	markup.push('');
	markup.push(json.info.summary.join('\n'));
	markup.push('');
	markup.push('---');

	markup.push('# Functions');

	_.each(json.functions, function(func) {
		markup.push('### ' + func.title);
		markup.push("\n```js\n " + func.code + " ```\n");
		markup.push('');
		markup.push(func.description.join('\n'));
		markup.push('\n---');
	});


	markup.push('# Methods');

	_.each(json.methods, function(func) {
		markup.push('### ' + func.title);
		markup.push("\n```js\n " + func.code + " ```\n");
		markup.push('');
		markup.push(func.description.join('\n'));
		markup.push('\n---');
	});
	return markup.join('\n');
}