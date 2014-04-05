module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON("package.json"),

    bower: {
      install: {
        options: {
          install: true,
          layout: 'byType',
          copy: false
        }
      }
    },

    jasmine: {
      options: {
        specs: 'spec/**/*_spec.js',
        helpers: 'spec/spec_helper.js',
        vendor: ['bower_components/knockout.js/knockout.js']
      },

      source: {
        src: [ 'src/*.js' ]
      }
    },

    uglify: {
      options: {
        compress: true,
        preserveComments: 'some',
        report: 'min'
      },

      build: {
        files: {
          'build/interpolator.min.js': [ 'src/interpolator.js' ]
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-bower-task');
  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('default', [
    'bower',
    'jasmine:source',
    'uglify'
  ]);
  grunt.registerTask('test', ['bower', 'jasmine:source']);
};
