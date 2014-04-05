module.exports = function (grunt) {
  var
    mustached = require('../build/interpolator.min'),
    path = require('path'),
    DOM = require('jsdom').jsdom;


  grunt.registerMultiTask('ko-mustached', 'Compiles mustached syntax into knockout bindings', function () {
    var options = this.options({
      bindings: [],
      override: false
    });

    var bindings = options.bindings.reduce(function (result, binding) {
      result[binding] = true;

      return result;
    }, {});

    mustached.interpolator.configure({
      document: DOM().parentWindow.document,
      bindings: bindings,
      compileFilter: options.compileFilter
    });

    this.files.forEach(function (file) {
      file.src.forEach(function (src) {
        var result = mustached.interpolator.compile(grunt.file.read(src));
        var dest = options.override ? src : file.dest;

        if (grunt.file.isDir(dest)) {
          dest = path.join(dest, path.basename(src));
        }

        grunt.log.writeln('Compiling ', src, ' to ', dest);

        grunt.file.write(dest, result);
      });

    });
  });
};