var ko = require('../bower_components/knockout.js/knockout.debug');

(function (ko, context) {
  var dataBind = 'data-bind';
  var sections;
  var document = context.document;
  var bindingSyntax = {
    value: function (bindingValue) {
      var matching = bindingValue.match(/of\s*:([^,]+),\s*update\s*:(.+)/);

      if (matching) {
        bindingValue = [ matching[1], ', valueUpdate:', matching[2] ].join('');
      }

      return bindingValue;
    },

    foreach: function (bindingValue) {
      var parts = bindingValue.split(/\s+in\s+/);

      return parts.length > 1 ? [ '{ data: ', parts[1], ', as: \'', parts[0].trim(), '\' }' ].join('') : bindingValue;
    },

    'default': function (bindingValue) {
      return  /^\s*\w+\s*:/.test(bindingValue) ? '{' + bindingValue + '}' : bindingValue;
    }
  };


  function compileTree(element) {
    var nextInQueue = element.firstChild, childElement = nextInQueue;

    compileSingle(element);
    while (nextInQueue) {
      nextInQueue = childElement.nextSibling;
      compileTree(childElement);
      childElement = nextInQueue;
    }

    return element.nodeType === 1 ? element.innerHTML : undefined;
  }

  function compileSingle(element) {
    if (element.nodeType === 3 && element.nodeValue && element.nodeValue.indexOf('{{') !== -1) {
      parseInterpolationMarkupIn(element);
    }

    if (element.nodeType === 1 && element.attributes.length > 0) {
      parseInterpolationInAttributesOf(element);
    }
  }

  function parseInterpolationMarkupIn(element) {
    var elements = [];

    parseInterpolationMarkup(element.nodeValue, function (text) {
      if (text) {
        elements.push(document.createTextNode(text));
      }
    }, function (expressionText) {
      if (expressionText) {
        elements.push.apply(elements, compileExpresssion(expressionText));
      }
    });

    if (elements.length > 1 || elements[0] !== element) {
      if (element.parentNode) {
        for (var i = 0; i < elements.length; i++) {
          element.parentNode.insertBefore(elements[i], element);
        }
        element.parentNode.removeChild(element);
      }
      return elements;
    }
  }


  function parseInterpolationMarkup(textToParse, outerTextCallback, expressionCallback) {
    var innerParse = function (text) {
      var innerMatch = text.match(/^([\s\S]*?)}}([\s\S]*)\{\{([\s\S]*)$/);
      if (innerMatch) {
        expressionCallback(innerMatch[1]);
        outerParse(innerMatch[2]);
        expressionCallback(innerMatch[3]);
      } else {
        expressionCallback(text);
      }
    };

    var outerParse = function (text) {
      var outerMatch = text.match(/^([\s\S]*?)\{\{([\s\S]*)}}([\s\S]*)$/);
      if (outerMatch) {
        outerTextCallback(outerMatch[1]);
        innerParse(outerMatch[2]);
        outerTextCallback(outerMatch[3]);
      } else {
        outerTextCallback(text);
      }
    };

    outerParse(textToParse);
  }

  function compileExpresssion(expressionText) {
    var matching = expressionText.match(/^\s*(\w+):(.+)/);
    var possibleBindingName = matching && matching[1];
    var compiledElements = [];

    if (possibleBindingName && ko.bindingHandlers[possibleBindingName]) {
      var convert = bindingSyntax[possibleBindingName] || bindingSyntax['default'];

      if (!ko.virtualElements.allowedBindings[possibleBindingName]) {
        throw new Error("The binding '" + possibleBindingName + "' cannot be used with virtual elements.");
      }

      sections.push(expressionText);
      expressionText = convert(matching[2]);
      compiledElements.push(document.createComment("ko " + possibleBindingName + ":" + expressionText));
    } else if (expressionText.trim() === '/end' && sections.length > 0) {
      sections.pop();
      compiledElements.push(document.createComment("/ko"));
    } else {
      compiledElements.push(
        document.createComment("ko text:" + compileFilters(expressionText)),
        document.createComment("/ko")
      );
    }

    return compiledElements;
  };

  function parseInterpolationInAttributesOf(node) {
    var parts, bindingValue;
    var addExpr = function (expressionText) {
      if (expressionText) {
        expressionText = expressionText.split('|');
        expressionText[0] = expressionText[0] + ' | unwrap';
        expressionText = expressionText.join('|');
        parts.push(compileFilters(expressionText));
      }
    };
    var addText = function (text) {
      if (text) {
        parts.push("'" + text.replace(/"/g, "\\'") + "'");
      }
    };

    for (var attrs = node.attributes, i = attrs.length - 1; i >= 0; --i) {
      var attr = attrs[i];

      bindingValue = '';
      if (attr.specified && attr.name != dataBind && attr.value) {
        if (attr.value.indexOf('{{') !== -1) {
          parts = [];
          parseInterpolationMarkup(attr.value, addText, addExpr);

          bindingValue = parts.join('+');
        } else if (ko.bindingHandlers[attr.name]) {
          bindingValue = attr.value;
        }

        if (bindingValue) {
          applyBindingTo(node, { name: attr.name, value: bindingValue });
          node.removeAttributeNode(attr);
        }
      }
    }
  }

  function applyBindingTo(element, binding) {
    var dataBindAttribute = element.getAttribute(dataBind);
    var convert = bindingSyntax[binding.name] || bindingSyntax['default'];
    var attrBindingPosition = null;
    var bindingExpr;

    binding.value = convert(binding.value);
    bindingExpr = "'" + binding.name + "':" + binding.value;

    if (!ko.bindingHandlers[binding.name]) {
      attrBindingPosition = dataBindAttribute ? dataBindAttribute.search(/attr\s*:\s*\{/) : -1;

      if (attrBindingPosition === -1) {
        bindingExpr = "attr: { " + bindingExpr + " }";
      } else {
        attrBindingPosition += RegExp.lastMatch.length
        dataBindAttribute = [
          dataBindAttribute.substr(0, attrBindingPosition),
          bindingExpr, ',',
          dataBindAttribute.substr(attrBindingPosition)
        ].join('');
      }
    }

    if (!dataBindAttribute) {
      dataBindAttribute = bindingExpr;
    } else if (attrBindingPosition === null) {
      dataBindAttribute += ', ' + bindingExpr;
    }

    element.setAttribute(dataBind, dataBindAttribute);
  }

  function compileFilters(input) {
    // Check if the input contains any | characters; if not, just return
    if (input.indexOf('|') === -1) {
      return input;
    }

    // Split the input into tokens, in which | and : are individual tokens, quoted strings are ignored, and all tokens are space-trimmed
    var tokens = input.match(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|\|\||[|:]|[^\s|:"'][^|:"']*[^\s|:"']|[^\s|:"']/g);
    if (tokens && tokens.length > 1) {
      // Append a line so that we don't need a separate code block to deal with the last item
      tokens.push('|');
      input = tokens[0];
      var lastToken, token, inFilters = false, nextIsFilter = false;
      for (var i = 1, token; token = tokens[i]; ++i) {
        if (token === '|') {
          if (inFilters) {
            if (lastToken === ':') {
              input += "undefined";
            }
            input += ')';
          }
          nextIsFilter = true;
          inFilters = true;
        } else {
          if (nextIsFilter) {
            input = context.interpolator.compileTextFilter(token) + "(" + input;
          } else if (inFilters && token === ':') {
            if (lastToken === ':') {
              input += "undefined";
            }
            input += ",";
          } else {
            input += token;
          }
          nextIsFilter = false;
        }
        lastToken = token;
      }
    }
    return input;
  }

  context.interpolator = {
    bindingSyntax: bindingSyntax,

    setDocument: function (doc) {
      document = doc;
    },

    compileTextFilter: function (filterName) {
      return filterName;
    },

    compile: function (html) {
      var element = document.createElement('div');

      element.innerHTML = html;
      sections = [];
      var html = compileTree(element);

      if (sections.length !== 0) {
        throw new Error("Unclosed section: " + sections.pop());
      }

      element.innerHTML = '';

      return html;
    }
  };
})(ko, module.exports);