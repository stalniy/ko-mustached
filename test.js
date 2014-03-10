var
  ko = require('./bower_components/knockout.js/knockout.debug'),
  interpolator = require('./src/interpolator').interpolator,
  dom = require('jsdom').jsdom;

ko.bindingHandlers.on = {};
ko.bindingHandlers.scope = {};

interpolator.document = dom().parentWindow.document;

var html = interpolator.compile([
  '<div if="hasTemplates()">',
    '{{ foreach: template in templates }}',
      '<a href="#" data-id="id-{{ id | $t | camelize }}">{{ name | upper | dosomething }}</a>',
      '<input value="of: title, update: \'afterkeydown\'" css="active: isActive, disabled: isLocked" scope="name: bla, template: \'template\'" />',
    '{{ /end }}',
  '</div>'
].join(''));

console.log(html);