Knockout Mustached Syntax
=============================

This library provides a tool which compiles mustached interpolation syntax into knockout binding declarations.

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
* compiles all DOM node attributes which start with **ko-** into bindings
* compiles attributes which contains mustached expressions into knockout `attr` binding
* allows to apply text filters
* allows to define custom syntax for bindings
* allows to create aliases for bindings which may have their own syntax
* automatically close specified virtual bindings (by default "partial" and "template" bindings)
* provides "partial" alias of "template" binding but with more freandly syntax (`{{ partial: templateName, param: 1, param2: 2 }}`)
* provides custom syntax for "foreach" binding (`{{ foreach: template in templates }} {{ template.name }} {{ /end }}`)
* provides to ways to use bindings as virtual elements: virtual elements which starts with "#" and those which has colon next to its name are perceived as bindings

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
    <a href="#" id="test" data-bind="attr:{'data-id':'id-'+dasherize(u(id)),'title':upper(u(title))}">
      <!--ko text:upper(name)--><!--/ko-->
    </a>
    <input type="text" data-bind="'css':{active: isActive, disabled: isLocked}, 'value':title, valueUpdate: 'afterkeydown'" />
  <!--/ko-->
</div>
```
**Note**: "u" filter is ko.unwrap.

And
```html
{{ #if canEdit() }}
  <a href="#" ko-click="editItem">Edit</a>
{{ /end }}
```
is compiled to
```html
<!--ko if: canEdit()-->
  <a href="#" data-bind="click: editItem">Edit</a>
<!--/ko-->
```

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
So, then `{{ title | upper }}` will be compiled to `<!--ko text:ko.filters['upper'](title)--><!--/ko-->`

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
You can precompile your mustached templates using grunt task.
If you use non-prefixed attributes for bindings (which names don't start with "ko-") you need to specify all available bindings, otherwise they wll be skipped or compiled as part of `attr` binding.
The easiest way to get the bindings list is to open your application and run in js console `Object.keys(ko.bindingHandlers)`.

Example of grunt task:

```js
grunt.initConfig({
  'ko-mustached': {
    options: {
      bindings: [
        "attr",
        "checked",
        "checkedValue",
        "css",
        "enable",
        "disable",
        "event",
        "foreach",
        "hasfocus",
        "hasFocus",
        "html",
        "if",
        "ifnot",
        "with",
        "options",
        "selectedOptions",
        "style",
        "submit",
        "text",
        "uniqueName",
        "value",
        "visible",
        "click",
        "template"
      ]
    },

    templates: {
      src: [ 'src/templates/mustached.html', 'src/templates/another-mustached.html' ],
      dest: 'build/templates'
    }
  }
});
```
In case if you want to override source files you can specify `override: true`. It's useful if you copy mustached templates into temporary folder.

## License

Released under the [MIT](http://www.opensource.org/licenses/MIT) License