(function (factory) {
  //CommonJS
  if (typeof require === 'function' && typeof exports === 'object' && typeof module === 'object') {
    factory(module.exports);
  //AMD
  } else if (typeof define === 'function' && define.amd) {
    define(['exports'], factory);
  //normal script tag
  } else {
    factory(window.mustached = {});
  }
})(function (context) {
  var dataBind = 'data-bind';
  var sections, document, bindingHandlers, virtualBindings;
  var tags = { open: '{{', close: '}}' };
  var bindingSyntax = {
    template: {
      autoClose: true
    },

    partial: {
      autoClose: true,

      as: 'template',

      compile: function (bindingValue) {
        var parts = bindingValue.match(/^([^,]+)\s*,\s*(.*)$/);

        if (!parts) {
          throw new Error('Unable to compile "partial" binding: ' + bindingValue);
        }

        if (parts[2]) {
          bindingValue = [ '{name:', parts[1].trim(), ',data:{', parts[2].trim(), '}}' ].join('');
        }

        return bindingValue;
      }
    },

    foreach: function (bindingValue) {
      var parts = bindingValue.split(/\s+in\s+/);

      return parts.length > 1 ? [ '{data:', parts[1].trim(), ',as:\'', parts[0].trim(), '\'}' ].join('') : bindingValue;
    },

    'default': function (bindingValue) {
      return  isObjectDeclaration(bindingValue) ? '{' + bindingValue + '}' : bindingValue;
    }
  };

  function isObjectDeclaration(string) {
    return /^\s*\w+\s*:/.test(string);
  }

  function camelize(word) {
    return word.replace(/[_.-]([a-z])/gi, function (match, pocket) {
      return pocket.toUpperCase();
    });
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
    } else if (element.nodeType === 1 && element.attributes.length > 0) {
      parseInterpolationInAttributesOf(element);
    }
  }

  function parseInterpolationMarkupIn(element) {
    var elements = parseInterpolationMarkup(element.nodeValue, compileExpresssion, compileTextNode);

    if (element.parentNode && (elements.length > 1 || elements[0] !== element)) {
      for (var i = 0; i < elements.length; i++) {
        element.parentNode.insertBefore(elements[i], element);
      }
      element.parentNode.removeChild(element);
    }
  }

  function parseInterpolationMarkup(text, compileExpression, compileText) {
    var startIndex, endIndex, expr;
    var index = 0;
    var length = text.length;
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
    expressionText = expressionText.trim();

    var compiledElements = [];
    var matching = expressionText.match(/^(?:#([\w_-]+)\s+|([\w_-]+)\s*:)(.+)$/) || [];
    var possibleBindingName = matching[1] || matching[2];
    var closeComment = document.createComment('/ko');

    if (possibleBindingName) {
      var binding = buildBinding(possibleBindingName, matching[3]);

      compiledElements.push(document.createComment('ko ' + binding.name + ':' + binding.value));

      if (binding.autoClose) {
        compiledElements.push(closeComment);
      } else {
        sections.push(expressionText);
      }
    } else if (expressionText === '/end') {
      if (sections.length === 0) {
        throw new Error('Unexpected close tag');
      }
      sections.pop();
      compiledElements.push(closeComment);
    } else {
      compiledElements.push(
        document.createComment('ko text:' + compileFilters(expressionText)),
        closeComment
      );
    }

    return compiledElements;
  }

  function compileTextNode(text) {
    return document.createTextNode(text);
  }

  function compileString(text) {
    return "'" + text.replace(/"/g, "\\'") + "'";
  }

  function compileAttributeExpresssion(expressionText) {
    var position = expressionText.indexOf('|');

    if (position !== -1) {
      expressionText = expressionText.substr(0, position) + '|u' + expressionText.substr(position);
    } else {
      expressionText += '|u';
    }

    return compileFilters(expressionText);
  }


  function buildBinding(name, valueExpr) {
    var compile = bindingSyntax['default'];
    var binding = { name: name, value: '' };
    var syntax = bindingSyntax[name];

    if (typeof syntax === 'function') {
      compile = syntax;
    } else if (typeof syntax === 'object' && syntax) {
      binding.autoClose = syntax.autoClose;

      if (syntax.compile) {
        compile = syntax.compile;
      }

      if (syntax.as) {
        binding.name = syntax.as;
      }
    }

    var result = compile(valueExpr);

    if (typeof result === 'string') {
      binding.value = result;
    } else if (typeof result === 'object') {
      binding.name = result.name;
      binding.value = result.value;
    }

    binding.value = compileFilters(binding.value.trim());

    return binding;
  }

  function parseInterpolationInAttributesOf(node) {
    var parts, bindingValue, bindingName, isBinding, possibleBindingName;

    for (var attrs = node.attributes, i = attrs.length - 1; i >= 0; --i) {
      var attr = attrs[i];

      if (attr.specified && attr.name !== dataBind && attr.value) {
        bindingValue = '';
        bindingName = attr.name;
        isBinding = bindingName.indexOf('ko-') !== -1;

        if (isBinding) {
          bindingName = bindingName.substr(3);
        }

        if (!isBinding && attr.value.indexOf(tags.open) !== -1 && attr.value.indexOf(tags.close) !== -1) {
          parts = parseInterpolationMarkup(attr.value, compileAttributeExpresssion, compileString);
          bindingValue = parts.join('+');
        } else {
          possibleBindingName = camelize(bindingName);

          if (isBinding || bindingHandlers[possibleBindingName] || bindingSyntax[possibleBindingName]) {
            isBinding = true;
            bindingName = possibleBindingName;
            bindingValue = attr.value;
          }
        }

        if (bindingValue) {
          applyBindingTo(node, { name: bindingName, value: bindingValue, exists: isBinding });
          node.removeAttributeNode(attr);
        }
      }
    }
  }

  function applyBindingTo(element, binding) {
    var dataBindAttribute = element.getAttribute(dataBind);
    var attrBindingPosition = null;
    var isBinding = binding.exists;

    binding = buildBinding(binding.name, binding.value);

    var bindingExpr = "'" + binding.name + "':" + binding.value;

    if (!isBinding) {
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
    var tokens = input.match(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|\|\||[|:]|[$\w_-]+|[^\s|:"']/g);
    if (tokens && tokens.length > 1) {
      // Append a line so that we don't need a separate code block to deal with the last item
      tokens.push(' ');
      input = '';

      var buffer = '';
      var inFilters = false;
      for (var i = 0, token; token = tokens[i]; ++i) {
        if (token === '|' && i !== tokens.length - 1) {
          if (inFilters) {
            buffer += ')';
          } else {
            buffer = tokens[i - 1] || '';
          }

          inFilters = true;
        } else if (tokens[i - 1] === '|') {
          buffer = compileTextFilter(token) + '(' + buffer;
        } else if (inFilters && token === ':') {
          var k = i;

          do {
            if (tokens[k + 1] === ':') {
              buffer += ',null';
            } else {
              buffer += ',' + tokens[++k];
            }
          } while(tokens[++k] === ':');

          i = k - 1;
        } else if (inFilters) {
          inFilters = false;
          input += buffer + ')' + token;
          buffer = '';
        } else if (tokens[i + 1] !== '|') {
          input += token;
        }
      }
    }

    return input.trim();
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
      if (!document || !compileTextFilter) {
        throw new Error([
          'Unable to compile html because of ',
          'one or more empty options "document", or "compileFilter".'
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
        throw new Error('Unclosed section: ' + sections.pop());
      }

      holder.innerHTML = '';

      return html;
    }
  };
});