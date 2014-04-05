var
  ko = require('./bower_components/knockout.js/knockout.debug'),
  interpolator = require('./build/interpolator.min').interpolator,
  dom = require('jsdom').jsdom;

interpolator.configure({
  document: dom().parentWindow.document,
  bindings: ko.bindingHandlers
});

var html = interpolator.compile([
  '<div if="hasTemplates()">',
    '{{ foreach: template in templates }}',
      '<a href="#" data-id="id-{{ id | $t | camelize }}" id="test" opa="{{ title | upper }}">{{ name | upper | dosomething }}</a>',
      '<input value="title, valueUpdate: \'afterkeydown\'" css="active: isActive, disabled: isLocked" scope="name: bla, template: \'template\'" />',
    '{{ /end }}',
  '</div>',

  '{{ template: name: \'test.me\', afterRender: func, data: { o: 1, a: 2 } }}',

  '<input value="password" />',
  '<div style="color: color, opacity: 0.5 + 0.1"></div>',
  '<a href="#" click="testMe, clickBubble: false">{{ shortDescription }}</a>'
].join(''));

console.log(html);