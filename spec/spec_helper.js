var matchMethods = {
  toHaveAttribute: function (attributeName) {
    var domNode = this.actual;
    this.actual = domNodeToString(domNode);

    return domNode.getAttribute(attributeName);
  },

  toContainText: function (expectedText) {
    var actualText = $(this.actual).text();
    var cleanedActualText = actualText.replace(/\r\n/g, "\n");
    this.actual = cleanedActualText;    // Fix explanatory message

    return cleanedActualText === expectedText;
  },

  toContainHtml: function (expectedHtml) {
    var cleanedHtml = this.actual.innerHTML.toLowerCase().replace(/\r\n/g, "");
    // IE < 9 strips whitespace immediately following comment nodes. Normalize by doing the same on all browsers.
    cleanedHtml = cleanedHtml.replace(/(<!--.*?-->)\s*/g, "$1");
    expectedHtml = expectedHtml.replace(/(<!--.*?-->)\s*/g, "$1");
    // Also remove __ko__ expando properties (for DOM data) - most browsers hide these anyway but IE < 9 includes them in innerHTML
    cleanedHtml = cleanedHtml.replace(/ __ko__\d+=\"(ko\d+|null)\"/g, "");
    this.actual = cleanedHtml;      // Fix explanatory message

    return cleanedHtml === expectedHtml;
  },

  toBeVisible: function () {
    var notText = this.isNot ? " not" : "";
    this.message = function () {
      return "Expected node to be " + notText + " visible";
    };

    return this.actual.offsetWidth !== 0 && this.actual.offsetHeight !== 0;
  },

  toBeInstanceOf: function (object) {
    return this.actual instanceof object;
  },

  toBeGreaterThanOrEqualTo: function (value) {
    return this.actual >= Number(value);
  }
};

var matchers = jasmine.Matchers.prototype;

for (var method in matchMethods) {
  matchers[method] = matchMethods[method];
}

function domNodeToString(domNode) {
  if (domNode.get) {
    domNode = domNode.get(0);
  }

  var props = [ domNode.nodeName.toLowerCase() ];

  if (domNode.id) {
    props.push('#' + domNode.id);
  }

  if (domNode.className) {
    props.push('.' + domNode.className.trim().replace(/\s+/g, '.'));
  }

  return props.join("");
}


var sharedExamples = {};

window.sharedExamplesFor = function (name, executor) {
  sharedExamples[name] = executor;
};

window.itBehavesLike = function (sharedExampleName) {
  jasmine.getEnv().describe("behaves like " + sharedExampleName, sharedExamples[sharedExampleName]);
};

window.includeExamplesFor = function (sharedExampleName) {
  var suite = jasmine.getEnv().currentSuite;
  sharedExamples[sharedExampleName].call(suite);
};

window.context = window.describe;
window.includeExamples = window.includeExamplesFor;