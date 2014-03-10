var ko = require('../bower_components/knockout.js/knockout.debug');

(function (ko, context) {
  function interpolationMarkupPreprocessor(node) {
    var nodes = [];
    function addTextNode(text) {
      if (text) {
        nodes.push(interpolator.document.createTextNode(text));
      }
    }
    function wrapExpr(expressionText) {
      if (expressionText) {
        nodes.push.apply(nodes, processExpresssion(node, expressionText));
      }
    }
    parseInterpolationMarkup(node.nodeValue, addTextNode, wrapExpr)

    if (nodes.length > 1 || nodes[0] !== node) {
      if (node.parentNode) {
        for (var i = 0; i < nodes.length; i++) {
          node.parentNode.insertBefore(nodes[i], node);
        }
        node.parentNode.removeChild(node);
      }
      return nodes;
    }
  }


  function parseInterpolationMarkup(textToParse, outerTextCallback, expressionCallback) {
    function innerParse(text) {
      var innerMatch = text.match(/^([\s\S]*?)}}([\s\S]*)\{\{([\s\S]*)$/);
      if (innerMatch) {
        expressionCallback(innerMatch[1]);
        outerParse(innerMatch[2]);
        expressionCallback(innerMatch[3]);
      } else {
        expressionCallback(text);
      }
    }
    function outerParse(text) {
      var outerMatch = text.match(/^([\s\S]*?)\{\{([\s\S]*)}}([\s\S]*)$/);
      if (outerMatch) {
        outerTextCallback(outerMatch[1]);
        innerParse(outerMatch[2]);
        outerTextCallback(outerMatch[3]);
      } else {
        outerTextCallback(text);
      }
    }
    outerParse(textToParse);
  }

  var sections = [];
  function processExpresssion(node, expressionText) {
    var matching = expressionText.match(/^\s*(\w+):(.+)/);
    var possibleBindingName = matching && matching[1];

    if (possibleBindingName && ko.bindingHandlers[possibleBindingName]) {
      if (!ko.virtualElements.allowedBindings[possibleBindingName]) {
        throw new Error("The binding '" + possibleBindingName + "' cannot be used with virtual elements.");
      }

      sections.push(expressionText);
      expressionText = (interpolator.bindingSyntax[possibleBindingName] || interpolator.bindingSyntax['default'])(matching[2]);

      return [ interpolator.document.createComment("ko " + possibleBindingName + ":" + expressionText) ];
    } else if (expressionText.trim() === '/end' && sections.length > 0) {
      sections.pop();
      return [ interpolator.document.createComment("/ko") ];
    }

    return [
      interpolator.document.createComment("ko text:" + filterPreprocessor(expressionText)),
      interpolator.document.createComment("/ko")
    ];
  };


  var dataBind = 'data-bind';
  function attributeBindingPreprocessor(node) {
    for (var attrs = node.attributes, i = attrs.length - 1; i >= 0; --i) {
      var attr = attrs[i], bindingValue = '';

      if (attr.specified && attr.name != dataBind && attr.value) {

        if (attr.value.indexOf('{{') !== -1) {
          var parts = [];
          function addText(text) {
            if (text)
              parts.push("'" + text.replace(/"/g, '"') + "'");
          }

          function addExpr(expressionText) {
            if (expressionText) {
              expressionText = expressionText.split('|');
              expressionText[0] = expressionText[0] + ' | unwrap';
              expressionText = expressionText.join('|');
              bindingValue = filterPreprocessor(expressionText);
              parts.push(bindingValue);
            }
          }

          parseInterpolationMarkup(attr.value, addText, addExpr);

          if (parts.length > 1) {
            bindingValue = parts.join('+');
          }
        } else if (ko.bindingHandlers[attr.name]) {
          bindingValue = filterPreprocessor(attr.value);
        }

        if (bindingValue) {
          applyBindingTo(node, [ attr.name, bindingValue ]);
          node.removeAttributeNode(attr);
        }
      }
    }
  }

  function applyBindingTo(node, binding) {
    var bindingName = binding[0], bindingValue = binding[1];
    var dataBindAttribute = node.getAttribute(dataBind);
    var preprocessor = (interpolator.bindingSyntax[bindingName] || interpolator.bindingSyntax['default']);

    bindingValue = preprocessor(bindingValue, node);

    if (ko.bindingHandlers[bindingName]) {
      binding = "'" + bindingName + "':" + bindingValue;

      if (dataBindAttribute) {
        dataBindAttribute += ', ' + binding;
      } else {
        dataBindAttribute = binding;
      }
    } else {
      binding = "'" + bindingName + "':" + bindingValue;

      if (!dataBindAttribute) {
        dataBindAttribute = "attr: { " + binding + " }";
      } else {
        var attrBindingPosition = dataBindAttribute.search(/attr\s*:\s*\{/);

        if (attrBindingPosition === -1) {
          dataBindAttribute += ", attr: { " + binding + " }";
        } else {
          attrBindingPosition += RegExp.lastMatch.length
          dataBindAttribute = dataBindAttribute.substr(0, attrBindingPosition) + binding + "," + dataBindAttribute.substr(attrBindingPosition);
        }
      }
    }

    node.setAttribute(dataBind, dataBindAttribute);
  }

  function forEachNodeInContinuousRange(firstNode, lastNode, action) {
    var node, nextInQueue = firstNode, firstOutOfRangeNode = ko.virtualElements.nextSibling(lastNode);

    while (nextInQueue && ((node = nextInQueue) !== firstOutOfRangeNode)) {
      nextInQueue = ko.virtualElements.nextSibling(node);
      action(node, nextInQueue);
    }
  }

  function compileTree(holder) {
    compileSingle(holder);

    if (holder && holder.nodeType === 1) {
      var children = ko.virtualElements.childNodes(holder);

      if (children.length > 0) {
        forEachNodeInContinuousRange(children[0], children[children.length - 1], function (node, nextNode) {
          compileTree(node);
        });
      }

      return holder.innerHTML;
    }
  }

  function compileSingle(node) {
    if (node.nodeType === 3 && node.nodeValue && node.nodeValue.indexOf('{{') !== -1) {
      interpolationMarkupPreprocessor(node);
    }

    if (node.nodeType === 1 && node.attributes.length) {
      attributeBindingPreprocessor(node);
    }
  }

  function filterPreprocessor(input) {
    // Check if the input contains any | characters; if not, just return
    if (input.indexOf('|') === -1)
        return input;

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
                    if (lastToken === ':')
                        input += "undefined";
                    input += ')';
                }
                nextIsFilter = true;
                inFilters = true;
            } else {
                if (nextIsFilter) {
                    input = interpolator.textFilter(token) + "(" + input;
                } else if (inFilters && token === ':') {
                    if (lastToken === ':')
                        input += "undefined";
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

  var interpolator = {
    document: context.document,

    textFilter: function (name) {
      return name;
    },

    compile: function (html) {
      var holder = interpolator.document.createElement('div');

      holder.innerHTML = html;
      sections = [];
      var html = compileTree(holder);

      if (sections.length !== 0) {
        throw new Error("Unclosed section: " + sections.pop());
      }

      return html;
    }
  };

  interpolator.bindingSyntax = {
    value: function (bindingValue) {
      var matching = bindingValue.match(/of\s*:([^,]+),\s*update\s*:(.+)/);

      if (matching) {
        bindingValue = [ matching[1], ', valueUpdate:', matching[2] ].join('');
      }

      return bindingValue;
    },

    foreach: function (bindingValue) {
      var parts = bindingValue.split(/\s+in\s+/);

      return parts.length > 1 ? '{ data: ' + parts[1] + ', as: \'' + parts[0].trim() + '\' }' : bindingValue;
    },

    'default': function (bindingValue) {
      return  /\w+\s*:/.test(bindingValue) ? bindingValue = '{' + bindingValue + '}' : bindingValue;
    }
  };

  context.interpolator = interpolator;
})(ko, module.exports);