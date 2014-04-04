(function (context) {
  var dataBind = 'data-bind';
  var sections, document, bindingHandlers, virtualBindings;
  var tags = { open: '{{', close: '}}' };
  var bindingSyntax = {
    value: function (bindingValue) {
      var parts = bindingValue.split(/,\s*update\s*:/);

      return parts.join(', valueUpdate: ');
    },

    foreach: function (bindingValue) {
      var parts = bindingValue.split(/\s+in\s+/);

      return parts.length > 1 ? [ '{ data: ', parts[1], ', as: \'', parts[0].trim(), '\' }' ].join('') : bindingValue;
    },

    'default': function (bindingValue) {
      return  isObjectDeclaration(bindingValue) ? '{' + bindingValue + '}' : bindingValue;
    }
  };

  function isObjectDeclaration(string) {
    return /^\s*\w+\s*:/.test(string);
  }

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
    if (element.nodeType === 3 && element.nodeValue) {
      parseInterpolationMarkupIn(element);
    }

    if (element.nodeType === 1 && element.attributes.length > 0) {
      parseInterpolationInAttributesOf(element);
    }
  }

  function parseInterpolationMarkupIn(element) {
    var elements = parseInterpolationMarkup(element.nodeValue, compileExpresssion, compileText);

    if (element.parentNode && (elements.length > 1 || elements[0] !== element)) {
      for (var i = 0; i < elements.length; i++) {
        element.parentNode.insertBefore(elements[i], element);
      }
      element.parentNode.removeChild(element);
    }
  }

  function parseInterpolationMarkup(text, compileExpression, compileText) {
    var startIndex, endIndex, index = 0, length = text.length, expr;
    var parts = [];

    while (index < length) {
      startIndex = text.indexOf(tags.open, index);
      endIndex = text.indexOf(tags.close, startIndex + tags.open.length);

      if (startIndex !== -1 && endIndex !== -1) {
        if (index !== startIndex) {
          parts.push(compileText(text.substring(index, startIndex)));
        }
        expr = text.substring(startIndex + tags.open.length, endIndex);
        parts = parts.concat(compileExpression(expr));
        index = endIndex + tags.close.length;
      } else {
        if (index !== length) {
          parts.push(compileText(text.substring(index)));
        }

        index = length;
      }
    }

    return parts;
  }

  function compileExpresssion(expressionText) {
    var matching = expressionText.match(/^\s*(\w+)\s*:(.+)/);
    var possibleBindingName = matching && matching[1];
    var compiledElements = [];

    if (possibleBindingName && bindingHandlers[possibleBindingName]) {
      var binding = buildBinding(possibleBindingName, matching[2]);

      sections.push(expressionText);
      compiledElements.push(document.createComment("ko " + binding.name + ":" + binding.value));
    } else if (expressionText.trim() === '/end' && sections.length > 0) {
      sections.pop();
      compiledElements.push(document.createComment("/ko"));
    } else {
      compiledElements.push(
        document.createComment("ko text:" + compileFilters(expressionText).trim()),
        document.createComment("/ko")
      );
    }

    return compiledElements;
  }

  function compileText(text) {
    return document.createTextNode(text);
  }

  function buildBinding(name, valueExpr) {
    var convert = bindingSyntax[name] || bindingSyntax['default'];
    var result = convert(valueExpr);
    var binding = { name: name, value: '' };

    if (typeof result === 'string') {
      binding.value = result;
    } else if (typeof result === 'object') {
      binding.name = result.name;
      binding.value = result.value;
    }

    binding.value = binding.value.trim();

    return binding;
  }

  function parseInterpolationInAttributesOf(node) {
    var parts, bindingValue;
    var compileExpresssion = function (expressionText) {
      expressionText = expressionText.split('|');
      expressionText[0] = expressionText[0] + ' | u';
      expressionText = expressionText.join('|');

      return compileFilters(expressionText);
    };
    var compileText = function (text) {
      return "'" + text.replace(/"/g, "\\'") + "'";
    };

    for (var attrs = node.attributes, i = attrs.length - 1; i >= 0; --i) {
      var attr = attrs[i];

      bindingValue = '';
      if (attr.specified && attr.name != dataBind && attr.value) {
        if (attr.value.indexOf(tags.open) !== -1 && attr.value.indexOf(tags.close) !== -1) {
          parts = parseInterpolationMarkup(attr.value, compileExpresssion, compileText);
          bindingValue = parts.join('+');
        } else if (bindingHandlers[attr.name]) {
          bindingValue = isObjectDeclaration(attr.value) ? attr.value : compileFilters(attr.value);
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
    var attrBindingPosition = null;

    binding = buildBinding(binding.name, binding.value);

    var bindingExpr = "'" + binding.name + "':" + binding.value;

    if (!bindingHandlers[binding.name]) {
      attrBindingPosition = dataBindAttribute ? dataBindAttribute.search(/attr\s*:\s*\{/) : -1;

      if (attrBindingPosition === -1) {
        bindingExpr = 'attr:{' + bindingExpr + '}';
      } else {
        attrBindingPosition += RegExp.lastMatch.length;
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
            input = compileTextFilter(token) + "(" + input;
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

  var compileTextFilter = function (filterName) {
    return filterName;
  }

  context.interpolator = {
    bindingSyntax: bindingSyntax,

    configure: function (options) {
      document = options.document;
      bindingHandlers = options.bindings;

      if (options.compileFilter) {
        compileTextFilter = options.compileFilter;
      }

      return this;
    },

    compile: function (html) {
      if (!document || !bindingHandlers || !compileTextFilter) {
        throw new Error([
          'Unable to compile html because of ',
          'one or more empty options "document", "bindingHandlers" or "compileFilter".'
        ].join(''));
      }

      sections = [];
      var holder = document.createElement('div');

      if (typeof html === 'string') {
        holder.innerHTML = html;
      } else if (html && html.nodeType) {
        holder.appendChild(html);
      } else {
        throw new Error('Unable to parse specified hmtl: ' + html);
      }

      html = compileTree(holder);

      if (sections.length !== 0) {
        throw new Error("Unclosed section: " + sections.pop());
      }

      holder.innerHTML = '';

      return html;
    }
  };
})(this);