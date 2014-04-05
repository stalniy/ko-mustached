Knockout Mustached Syntax
=============================

This library provides a tool which can compile mustached interpolation syntax into knockout binding declarations.

## Installation
Using npm: `npm install ko-mustached`

Or

Just clone repository and assemble all the files with `grunt`:
```sh
git clone git@github.com:stalniy/ko-mustached.git
cd ko-mustached
npm install
grunt # or grunt test if you want just test the package
```

## What is the goal?

The goal is to simplify knockout templates.

## What it does

It is just a compiler and works only with strings, it knows nothing about your view models and another js code, but it **can**:
* compiles string with mustached expressions into knockout virtual bindings
* compiles DOM node attributes into bindings if such exists
* compiles attributes which contains mustached expressions into knockout `attr` binding
* allows to apply text filters
* allows to define custom syntax for bindings
* allows to create aliases for bindings which may have their own syntax
* automatically close specified virtual bindings (by default "partial" and "template" bindings)
* provides "partial" alias of "template" binding but with more freandly syntax (`{{ partial: templateName, param: 1, param2: 2 }}`)
* provides custom syntax for "foreach" binding (`{{ foreach: template in templates }} {{ template.name }} {{ /end }}`)

### Example
```html
  <div if="hasTemplates()">
    {{ foreach: template in templates }}
      <a href="#" data-id="id-{{ id | dasherize }}" id="test" title="{{ title | upper }}">{{ name | upper }}</a>
      <input value="title, valueUpdate: 'afterkeydown'" css="active: isActive, disabled: isLocked" />
    {{ /end }}
  </div>
```
This example is compiled to:
```html
<div data-bind="'if':hasTemplates()">
  <!--ko foreach:{data:templates ,as:'template'}-->
    <a href="#" id="test" data-bind="attr:{'dataId':'id-'+dasherize(u(id)),'title':upper(u(title))}">
      <!--ko text:upper(name)--><!--/ko-->
    </a>
    <input type="text" data-bind="'css':{active: isActive, disabled: isLocked}, 'value':title, valueUpdate: 'afterkeydown'" />
  <!--/ko-->
</div>
```
"u" filter is ko.unwrap.

### Configuration options
Mustached interpolator has few configuration options:
* *document* - document object
* *bindings* - object map of available bindings
* *compileFilter* - function which receives text filter name and returns new name which is used in compiled html

For example:
```js
mustached.interpolator.configure({
  document: window.document,
  bindings: ko.bindingHandlers,
  compileFilter: function (name) {
    return "ko.filters['" + name + "']";
  }
})
```
So, then `{{ title | upper }}` will be compiled to `<!--ko text:ko.filters['upper']--><!--/ko-->`

## How to use with AMD

Create a very SIMPLE plugin:
```js
define(['knockout', 'ko-mustached'], function (ko, mustached) {
  mustached.interpolator.configure({
    document: window.document,
    bindings: ko.bindingHandlers
  });

  return {
    load: function (template, require, onload, config) {
      require(['text!' + template], function (html) {
        html = mustached.interpolator.compile(html);
        onload(html);
      });
    }
  };
});

require.config({
  paths: {
    kom: 'path to amd plugin'
  }
});
```
And then load your templates:
```js
require(['knockout', 'path/to/view/model', 'kom!path/to/template.html'], function (ko, viewModel, html) {
  document.body.innerHTML = html;
  ko.applyBindings(viewModel);
});
```

## What about production?
TODO: write something about grunt task =)

## License

Released under the [MIT](http://www.opensource.org/licenses/MIT) License