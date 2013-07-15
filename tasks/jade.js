/*
 * grunt-contrib-jade
 * http://gruntjs.com/
 *
 * Copyright (c) 2012 Eric Woroshow, contributors
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {
  var _ = grunt.util._;
  var helpers = require('grunt-lib-contrib').init(grunt);

  // content conversion for templates
  var defaultProcessContent = function(content) { return content; };

  // filename conversion for templates
  var defaultProcessName = function(name) { return name.replace('.jade', ''); };

  grunt.registerMultiTask('jade', 'Compile jade templates.', function() {
    var options = this.options({
      namespace: 'JST',
      separator: grunt.util.linefeed + grunt.util.linefeed,
      amd: false,
      extension: 'html'
    });
    grunt.verbose.writeflags(options, 'Options');

    var data = options.data;
    delete options.data;

    var nsInfo;

    if(options.namespace !== false){
      nsInfo = helpers.getNamespaceDeclaration(options.namespace);
    }

    // assign transformation functions
    var processContent = options.processContent || defaultProcessContent;
    var processName = options.processName || defaultProcessName;

    var compile = function(orig, dest, fsrc, filepath) {
      var src = processContent(grunt.file.read(filepath));
      var compiled, filename;
      filename = processName(filepath);

      options = grunt.util._.extend(options, { filename: filepath });

      try {
        compiled = require('jade').compile(src, options);
        // if in client mode, return function source
        if (options.client) {
          compiled = compiled.toString();
        } else {
          // if data is function, bind to f.orig, passing f.dest and f.src
          compiled = compiled(_.isFunction(data) ? data.call(orig, dest, fsrc) : data);
        }
        
        // if configured for amd and the namespace has been explicitly set
        // to false, the jade template will be directly returned
        if (options.client && options.amd && options.namespace === false) {
          compiled = 'return ' + compiled;
        }
      } catch (e) {
        grunt.log.error(e);
        grunt.fail.warn('Jade failed to compile '+filepath+'.');
      }

      if (options.client && options.namespace !== false) {
        return nsInfo.namespace+'['+JSON.stringify(filename)+'] = '+compiled+';';
      }

      return compiled;
    };

    var writeFile = function(dest, templates) {
      var output = templates;
      if (output.length < 1) {
        grunt.log.warn('Destination not written because compiled files were empty.');
        return;
      }

      if (options.client && options.namespace !== false) {
        output.unshift(nsInfo.declaration);

        if (options.node) {
          output.unshift('var jade = jade || require(\'jade\').runtime;');

          var nodeExport = 'if (typeof exports === \'object\' && exports) {';
          nodeExport += 'module.exports = ' + nsInfo.namespace + ';}';

          output.push(nodeExport);
        }
      }

      if (options.amd) {
        // Wrap the file in an AMD define fn.
        output.unshift("define(['jade'], function(jade) { if(jade && jade['runtime'] !== undefined) { jade = jade.runtime; }");
        if (options.namespace !== false) {
          // Namespace has not been explicitly set to false; the AMD
          // wrapper will return the object containing the template.
          output.push("return "+nsInfo.namespace+";");
        }
        output.push("});");
      }

      grunt.file.write(dest, output.join(grunt.util.normalizelf(options.separator)));
      grunt.log.writeln('File "' + dest + '" created.');
    };

    var pushData = function(dest, templates, data) {
      if (!Array.isArray(templates[dest])) {
        templates[dest] = [];
      }

      templates[dest].push(data);
    };


    // execute
    this.files.forEach(function(f) {
      var templates = {};

      f.src.filter(function(filepath) {
        // Warn on and remove invalid source files (if nonull was set).
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        } else {
          return true;
        }
      })
      .forEach(function(filepath) {
        if (grunt.file.isDir(filepath)) {
          grunt.file.recurse(filepath, function(abspath, rootdir, subdir, filename) {
            if (filename.lastIndexOf(".jade") === -1) {
              return;
            }
            var relatedPath = subdir || '';
            relatedPath = filename.lastIndexOf(".") === -1 ?
              filename + "." + options.extension :
              filename.substring(0, filename.lastIndexOf(".")) + "." + options.extension;

            var keyPath = f.dest + relatedPath;
            pushData(keyPath, templates, compile(f.orig, keyPath, f.src, abspath));
          });
        } else {
          pushData(f.dest, templates, compile(f.orig, f.dest, f.src, filepath));
        }
      });

      Object.keys(templates).forEach(function(key) {
        writeFile(key, templates[key]);
      })
    });

  });

};
