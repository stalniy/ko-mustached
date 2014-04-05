describe('Syntax interpolator', function () {
  ko.bindingHandlers.hint = {};

  it ('throws exception if not configured', function () {
    interpolator.configure({ document: null, bindings: null });

    expect(function () {
      interpolator.compile('{{ expression }}');
    }).toThrow();
  })

  context('when process text', function () {

    it ('throws exception if found unexpected close tag', function () {
      expect(function () {
        configureInterpolator().compile('no expressions {{ /end }}');
      }).toThrow();
    })

    it ('throws exception if found unclosed section', function () {
      expect(function () {
        configureInterpolator().compile('{{ foreach: template in templates }}test');
      }).toThrow();
    })

    it ('does nothing if there is no expressions in specified string', function () {
      var html = configureInterpolator().compile('no expressions');

      expect(html).toEqual('no expressions');
    })

    it ('does nothing if specified string is empty', function () {
      var html = configureInterpolator().compile('');

      expect(html).toEqual('');
    })

    it ('does not parse unclosed expressions', function () {
      var expr = 'some {{ text';
      var html = configureInterpolator().compile(expr);

      expect(html).toEqual(expr);
    })

    it ('does not parse unopened expressions', function () {
      var expr = 'some }} text';
      var html = configureInterpolator().compile(expr);

      expect(html).toEqual(expr);
    })

    it ('compiles expressions into comment nodes', function () {
      var html = configureInterpolator().compile('{{ item }} : {{ value }}!');

      expect(html).toEqual('<!--ko text:item--><!--/ko--> : <!--ko text:value--><!--/ko-->!')
    })

    it ('ignores unmatched delimiters', function () {
      var html = configureInterpolator().compile('{{ item }} then delimiter }} and again {{');

      expect(html).toEqual('<!--ko text:item--><!--/ko--> then delimiter }} and again {{');
    })

    it ('supports function calls in expressions', function () {
      var html = configureInterpolator().compile('{{ 1 + 2 }} {{ equals() }} 3');

      expect(html).toEqual('<!--ko text:1 + 2--><!--/ko--> <!--ko text:equals()--><!--/ko--> 3');
    })

    it ('compiles filters to function calls', function () {
      var html = configureInterpolator().compile('This book is named: {{ title | upper | ellipsis: 100 }}');

      expect(html).toEqual('This book is named: <!--ko text:ellipsis(upper(title),100)--><!--/ko-->');
    })

    it ('compiles bindings inside interpolation syntax', function () {
      var html = configureInterpolator().compile('{{ if: hasItems() }}test me{{ /end }}');

      expect(html).toEqual('<!--ko if:hasItems()-->test me<!--/ko-->')
    })
  })

  context('when process attributes', function () {
    it ('compiles them into bindings if such are exists', function () {
      var html = configureInterpolator().compile('<div if="hasItems()">There 5 items</div>');

      expect(html).toEqual('<div data-bind="\'if\':hasItems()">There 5 items</div>');
    })

    it ('leaves as is if there is no binding with such name and no interpolation syntax in attribute', function () {
      var source = '<div id="test" class="my-class">There 5 items</div>';
      var html = configureInterpolator().compile(source);

      expect(html).toEqual(source);
    })

    it ('does not parse unclosed tags', function () {
      var source = '<div id="test {{ me"></div>';
      var html = configureInterpolator().compile(source);

      expect(html).toEqual(source);
    })

    it ('does not parse unopened tags', function () {
      var source = '<div id="test }} me"></div>';
      var html = configureInterpolator().compile(source);

      expect(html).toEqual(source);
    })

    it ('compiles attributes into "attr" binding', function () {
      var html = configureInterpolator().compile('<div id="{{ id }}" data-title="{{ title }}" class="css"></div>');

      expect(html).toEqual('<div class="css" data-bind="attr:{\'id\':u(id),\'data-title\':u(title)}"></div>');
    })

    it ('compiles attributes which have several expressions', function () {
      var html = configureInterpolator().compile('<div id="id-{{ id }}-{{ title | lower }}" title="{{ title }}" class="css"></div>');

      expect(html).toEqual('<div class="css" data-bind="attr:{\'id\':\'id-\'+u(id)+\'-\'+lower(u(title)),\'title\':u(title)}"></div>')
    })

    it ('does not match expressions in data-bind attribute', function () {
      var html = configureInterpolator().compile('<div data-bind="text-{{ id }}"></div>');

      expect(html).toEqual('<div data-bind="text-{{ id }}"></div>');
    })

    it ('allows to define custom binding syntax', function () {
      this.after(function () {
        delete interpolator.bindingSyntax.template;
      });

      interpolator.bindingSyntax.template = function (bindingValue) {
        if (bindingValue.indexOf(',') !== -1) {
          bindingValue = bindingValue.match(/^([^,]+)(?:,\s*(.+))?$/);
          bindingValue = ['{name:', bindingValue[1], ',data:{', bindingValue[2], '}}'].join('');
        }

        return bindingValue;
      };

      var html = configureInterpolator().compile('<div template="\'test\', item: 1, data: 2"></div>');

      expect(html).toEqual('<div data-bind="\'template\':{name:\'test\',data:{item: 1, data: 2}}"></div>');
    })

    it ('compiles filters inside binding value', function () {
      var html = configureInterpolator().compile('<div hint="title | upper"></div>');

      expect(html).toEqual('<div data-bind="\'hint\':upper(title)"></div>');
    })

    it ('does not compile filters if binding definition looks like object literal', function () {
      var html = configureInterpolator().compile('<div template="name: title | upper, data: test"></div>');

      expect(html).toEqual('<div data-bind="\'template\':{name: title | upper, data: test}"></div>');
    })
  })

  describe('Default binding syntax', function () {
    it ('compiles binding value into object if string starts from key/value pair', function () {
      var html = configureInterpolator().compile('<div css="blue: isOpened, active: isActive()"></div>');

      expect(html).toEqual('<div data-bind="\'css\':{blue: isOpened, active: isActive()}"></div>');
    })

    it ('leaves binding value as is if string does not starts from key/value pair', function () {
      var html = configureInterpolator().compile('<a click="openWindow, clickBubble: false"></a>');

      expect(html).toEqual('<a data-bind="\'click\':openWindow, clickBubble: false"></a>');
    })

    it ('has custom syntax for "foreach" binding', function () {
      var html = configureInterpolator().compile('<div foreach="template in templates"></div>');

      expect(html).toEqual('<div data-bind="\'foreach\':{data:templates,as:\'template\'}"></div>');
    })

    it ('has "partial" binding as an alias for "template"', function () {
      var html = configureInterpolator().compile('{{ partial: template, value: 1, data: 3 }}');

      expect(html).toEqual('<!--ko template:{name:template,data:{value: 1, data: 3}}--><!--/ko-->');
    })

    it ('supports creation of binding aliases', function () {
      interpolator.bindingSyntax.testAlias = { as: 'text' };
      var html = configureInterpolator().compile('<div test-alias="item"></div>');

      expect(html).toEqual('<div data-bind="\'text\':item"></div>');

      delete interpolator.bindingSyntax.testAlias;
    })

    it ('supports auto closing for virtual bindings', function () {
      interpolator.bindingSyntax.custom = { autoClose: true };
      var html = configureInterpolator().compile('{{ custom: binding }}');

      expect(html).toEqual('<!--ko custom:binding--><!--/ko-->');

      delete interpolator.bindingSyntax.custom;
    })
  })


  function configureInterpolator() {
    return interpolator.configure({
      document: window.document,
      bindings: ko.bindingHandlers
    });
  }
})