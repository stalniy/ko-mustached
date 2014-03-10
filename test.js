var
  ko = require('./bower_components/knockout.js/knockout.debug'),
  interpolator = require('./src/interpolator').interpolator,
  dom = require('jsdom').jsdom;

ko.bindingHandlers.on = {};
ko.bindingHandlers.scope = {};

interpolator.setDocument(dom().parentWindow.document);

var html = interpolator.compile([
  '<div if="hasTemplates()">',
    '{{ foreach: template in templates }}',
      '<a href="#" data-id="id-{{ id | $t | camelize }}" id="test" opa="{{ title | upper }}">{{ name | upper | dosomething }}</a>',
      '<input value="of: title, update: \'afterkeydown\'" css="active: isActive, disabled: isLocked" scope="name: bla, template: \'template\'" />',
    '{{ /end }}',
  '</div>',

  '{{ template: name: \'test.me\', afterRender: func, data: { o: 1, a: 2 } }}{{ /end }}',

  '<input value="password" />',
  '<div style="color: color, opacity: 0.5 + 0.1"></div>',
  '<a href="#" click="testMe, clickBubble: false">{{ shortDescription }}</a>'
].join(''));

console.log(html);